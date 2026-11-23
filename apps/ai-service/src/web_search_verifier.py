import re
import unicodedata
import urllib.parse
from difflib import SequenceMatcher
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from .config import settings
from .schemas import WebVerificationResult

# Thứ tự ưu tiên khi nhiều kết quả cùng đạt ngưỡng:
# official (trường ĐH, tổ chức uy tín) > news (báo chí) > social (MXH) > public (khác)
_TIER_RANK = {"official": 0, "news": 1, "social": 2, "public": 3}


class WebSearchVerifierService:
    ACCEPT_THRESHOLD = 0.50      # ngưỡng nhận một kết quả (hạ xuống để bắt tên sự kiện ngắn)
    BOOST_THRESHOLD = 0.65       # ngưỡng được cộng điểm tin cậy
    OFFICIAL_BOOST = 20          # nguồn chính thống (DUT/đại học/đoàn - hội/tổ chức uy tín)
    NEWS_BOOST = 15              # báo chí, trang tin có kiểm duyệt
    OTHER_BOOST = 10             # mạng xã hội, blog, nguồn công khai khác

    @staticmethod
    async def verify_event(
        activity_name: str,
        year: Optional[str] = None,
        organizer: Optional[str] = None,
    ) -> WebVerificationResult:
        clean_activity = re.sub(r"[\"']", "", activity_name).strip()
        if not clean_activity:
            return WebVerificationResult(errorDetails="Không có tên hoạt động để tra cứu.")
        year_part = f" {year}" if year else ""
        organizer_part = f' "{organizer}"' if organizer else ""

        # Tạo nhiều query để tăng khả năng tìm thấy kết quả:
        # - Query 1: tên sự kiện + đơn vị tổ chức + năm (chính xác nhất)
        # - Query 2: tên sự kiện + năm + "kết quả" hoặc "danh sách" (tìm bài đăng kết quả)
        # Dùng DuckDuckGo HTML để không cần API key, tránh gửi PII ra ngoài.
        query_primary = f'"{clean_activity}"{organizer_part}{year_part}'
        query_fallback = f'{clean_activity}{year_part} kết quả danh sách tham gia'
        url_primary = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query_primary)}"
        url_fallback = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query_fallback)}"
        headers = {"User-Agent": "UniProof-AI evidence verifier/1.0 (academic use)"}

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                response = await client.get(url_primary, headers=headers)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")
                candidates = WebSearchVerifierService._parse_candidates(activity_name, soup)

                # Nếu query chính không tìm thấy gì, thử query fallback tiếng Việt
                if not candidates:
                    response2 = await client.get(url_fallback, headers=headers)
                    response2.raise_for_status()
                    soup2 = BeautifulSoup(response2.text, "html.parser")
                    candidates = WebSearchVerifierService._parse_candidates(activity_name, soup2)
                    query_used = query_fallback
                else:
                    query_used = query_primary

        except httpx.TimeoutException:
            return WebVerificationResult(searched=True, queryUsed=query_primary, errorDetails="Tra cứu web hết thời gian chờ.")
        except httpx.HTTPError as error:
            return WebVerificationResult(searched=True, queryUsed=query_primary, errorDetails=f"Tra cứu web thất bại: {error}")

        if not candidates:
            return WebVerificationResult(
                searched=True,
                queryUsed=query_used,
                confidenceBoost=0,
                errorDetails=None,
            )

        # Ưu tiên nguồn chính thống trước, sau đó tới điểm khớp cao nhất.
        candidates.sort(key=lambda item: (_TIER_RANK.get(item[0], 9), -item[1]))
        tier, match_score, title, article_url, snippet = candidates[0]
        boost = 0
        if match_score >= WebSearchVerifierService.BOOST_THRESHOLD:
            if tier == "official":
                boost = WebSearchVerifierService.OFFICIAL_BOOST
            elif tier == "news":
                boost = WebSearchVerifierService.NEWS_BOOST
            else:
                boost = WebSearchVerifierService.OTHER_BOOST
        return WebVerificationResult(
            searched=True,
            queryUsed=query_used,
            articleTitle=title,
            articleUrl=article_url,
            snippet=snippet[:500],
            matchScore=round(match_score, 2),
            confidenceBoost=boost,
        )

    @staticmethod
    def _parse_candidates(
        activity_name: str, soup: BeautifulSoup
    ) -> list[tuple[str, float, str, str, str]]:
        """Trích xuất và lọc kết quả tìm kiếm từ trang DuckDuckGo HTML."""
        candidates: list[tuple[str, float, str, str, str]] = []
        for result in soup.select(".result"):
            title_anchor = result.select_one(".result__title a")
            snippet_node = result.select_one(".result__snippet")
            if not title_anchor:
                continue
            title = title_anchor.get_text(" ", strip=True)
            raw_href = title_anchor.get("href")
            article_url = WebSearchVerifierService._resolve_result_url(
                raw_href if isinstance(raw_href, str) else ""
            )
            snippet = snippet_node.get_text(" ", strip=True) if snippet_node else ""
            tier = WebSearchVerifierService._source_tier(article_url)
            if tier is None:
                continue
            match_score = WebSearchVerifierService._similarity(activity_name, f"{title} {snippet}")
            if match_score < WebSearchVerifierService.ACCEPT_THRESHOLD:
                continue
            candidates.append((tier, match_score, title, article_url, snippet))
        return candidates

    @staticmethod
    def _resolve_result_url(raw_url: str) -> str:
        parsed = urlparse(raw_url)
        if parsed.path.startswith("/l/"):
            target = parse_qs(parsed.query).get("uddg", [])
            if target:
                return target[0]
        if raw_url.startswith("//"):
            return f"https:{raw_url}"
        return raw_url

    @staticmethod
    def _parse_domains(value: str) -> list[str]:
        return [item.strip().lower().rstrip(".") for item in value.split(",") if item.strip()]

    @staticmethod
    def _matches(host: str, domain: str) -> bool:
        return host == domain or host.endswith(f".{domain}")

    @staticmethod
    def _source_tier(url: str) -> Optional[str]:
        """Phân loại nguồn: official / news / social / public; None nếu không hợp lệ.

        Chấp nhận mọi tên miền công khai khi `ALLOW_ALL_PUBLIC_SOURCES` bật.
        """
        host = (urlparse(url).hostname or "").lower().rstrip(".")
        if not host or "." not in host:
            return None
        official = WebSearchVerifierService._parse_domains(settings.OFFICIAL_SOURCE_DOMAINS)
        if settings.DUT_DOMAIN.lower().rstrip(".") not in official:
            official.append(settings.DUT_DOMAIN.lower().rstrip("."))
        if any(WebSearchVerifierService._matches(host, domain) for domain in official):
            return "official"
        if not settings.ALLOW_ALL_PUBLIC_SOURCES:
            return None
        if any(WebSearchVerifierService._matches(host, domain) for domain in WebSearchVerifierService._parse_domains(settings.NEWS_SOURCE_DOMAINS)):
            return "news"
        if any(WebSearchVerifierService._matches(host, domain) for domain in WebSearchVerifierService._parse_domains(settings.SOCIAL_SOURCE_DOMAINS)):
            return "social"
        return "public"

    @staticmethod
    def _normalize(value: str) -> str:
        decomposed = unicodedata.normalize("NFD", value.casefold())
        normalized = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
        return re.sub(r"[^a-z0-9 ]", " ", normalized.replace("đ", "d"))

    @staticmethod
    def _similarity(activity_name: str, candidate: str) -> float:
        activity = WebSearchVerifierService._normalize(activity_name)
        result = WebSearchVerifierService._normalize(candidate)
        sequence = SequenceMatcher(None, activity, result).ratio()
        activity_tokens = {word for word in activity.split() if len(word) > 2}
        result_tokens = set(result.split())
        token_overlap = len(activity_tokens & result_tokens) / len(activity_tokens) if activity_tokens else 0.0
        return max(sequence, token_overlap)
