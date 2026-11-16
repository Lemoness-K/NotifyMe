---
layout: default
title: 문서 리뷰
---

# AI-DLC 단계 리뷰

각 단계가 끝날 때 검토가 필요한 산출물만 모아 둡니다. 문서를 열어 확인한 뒤, 다음 세션에서 피드백이나 승인 내용을 알려주세요.

{% assign review_packs = site.data.reviews | reverse %}
{% if review_packs.size == 0 %}
<p class="empty-state">아직 등록된 리뷰 문서가 없습니다.</p>
{% else %}
{% for pack in review_packs %}
<section class="review-pack">
  <p class="eyebrow">{{ pack.created_at | date: "%Y-%m-%d %H:%M UTC" }} · {{ pack.intent }}</p>
  <h2>{{ pack.stage_title | escape }}</h2>
  <p>{{ pack.summary | escape }}</p>
  {% if pack.next_stage and pack.next_stage != "" %}
  <p class="next-stage">승인 후 다음 단계: {{ pack.next_stage | escape }}</p>
  {% endif %}
  <ul class="document-list">
    {% for file in pack.files %}
    <li>
      <a href="{{ file.url | relative_url }}">{{ file.title | escape }}</a>
      <p>{{ file.summary | escape }}</p>
    </li>
    {% endfor %}
  </ul>
</section>
{% endfor %}
{% endif %}

<p class="privacy-note">이 저장소와 Pages 사이트는 공개 상태입니다. 민감 정보가 포함된 문서는 게시하지 않습니다.</p>
