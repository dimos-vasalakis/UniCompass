from typing import Annotated, Literal

from fastapi import Query

Lang = Literal["en", "el"]
# Public endpoints take ?lang=el to get Greek text; English is the default and
# the fallback wherever a translation is missing.
LangParam = Annotated[Lang, Query(description="Language of the returned text")]


def pick(lang: Lang, en: str, el: str | None) -> str:
    return el if lang == "el" and el else en


def points(lang: Lang, raw: list[dict]) -> list[dict]:
    return [
        {"text": pick(lang, p["text"], p.get("text_el")), "factor": p.get("factor")}
        for p in raw
    ]
