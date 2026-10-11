/* JP이야기 고객응대 챗봇 위젯
 * - 화면 오른쪽 아래 상담 버튼 → 채팅창
 * - 질문: POST /api/chat, 상담 신청: POST /api/lead
 * - 이 파일에는 어떤 키도 넣지 않는다. 모든 키는 서버(api/)에서만 쓴다.
 */
(function () {
  "use strict";
  if (window.JPChat) return;

  var PHONE = "010-3848-5949";
  var KAKAO = "http://pf.kakao.com/_RhKwG";
  var MAX_LEN = 1000;
  var GREETING =
    "안녕하세요, JP이야기 상담 안내 챗봇입니다.\n매매·임대 중개, 내집마련 컨설팅, 신축 분양, 분양 현장 촬영, 유튜브 촬영 협업에 대해 물어보세요.";
  var SUGGESTIONS = [
    "중개보수는 어떻게 계산하나요?",
    "유튜브 촬영 협업은 어떻게 진행되나요?",
    "내집마련 컨설팅이 궁금해요",
  ];

  var CSS = [
    ".jpc, .jpc *{box-sizing:border-box;font-family:Inter,Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;letter-spacing:-0.005em}",
    ".jpc-launch{position:fixed;right:24px;bottom:24px;z-index:2147483000;display:flex;align-items:center;gap:10px;height:60px;padding:0 24px 0 18px;border:0;border-radius:9999px;background:#E11D48;color:#fff;font-weight:700;font-size:16px;cursor:pointer;box-shadow:0 12px 28px -6px rgba(225,29,72,.55),0 4px 10px rgba(15,23,42,.18);transition:transform .15s,background .15s}",
    ".jpc-launch:hover{background:#BE123C;transform:translateY(-2px)}",
    ".jpc-launch:focus-visible{outline:3px solid #0F172A;outline-offset:3px}",
    ".jpc-launch svg{width:26px;height:26px;flex:none}",
    ".jpc-launch::before{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 0 rgba(225,29,72,.55);animation:jpc-pulse 2.2s infinite}",
    "@keyframes jpc-pulse{0%{box-shadow:0 0 0 0 rgba(225,29,72,.5)}70%{box-shadow:0 0 0 16px rgba(225,29,72,0)}100%{box-shadow:0 0 0 0 rgba(225,29,72,0)}}",
    ".jpc-badge{position:absolute;top:-4px;right:-2px;width:14px;height:14px;border-radius:50%;background:#10B981;border:2px solid #fff}",
    ".jpc-tip{position:fixed;right:24px;bottom:96px;z-index:2147483000;max-width:240px;padding:12px 36px 12px 14px;border-radius:12px;background:#0F172A;color:#fff;font-size:14px;line-height:21px;box-shadow:0 12px 24px -4px rgba(15,23,42,.3)}",
    ".jpc-tip::after{content:'';position:absolute;right:34px;bottom:-6px;width:12px;height:12px;background:#0F172A;transform:rotate(45deg)}",
    ".jpc-tip button{position:absolute;top:6px;right:6px;width:24px;height:24px;border:0;background:transparent;color:#94A3B8;font-size:18px;line-height:1;cursor:pointer}",
    ".jpc-panel{position:fixed;right:24px;bottom:24px;z-index:2147483001;width:384px;height:min(640px,calc(100vh - 48px));display:flex;flex-direction:column;background:#fff;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;box-shadow:0 24px 48px -12px rgba(15,23,42,.28)}",
    ".jpc-head{display:flex;align-items:center;gap:12px;padding:16px 16px 14px;background:#0A0F1D;color:#fff}",
    ".jpc-avatar{width:40px;height:40px;flex:none;border-radius:10px;background:#E11D48;display:grid;place-items:center;font-weight:800;font-size:15px}",
    ".jpc-title{font-weight:700;font-size:16px;line-height:22px}",
    ".jpc-sub{font-size:12px;line-height:16px;color:#94A3B8}",
    ".jpc-close{margin-left:auto;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:#CBD5E1;cursor:pointer;display:grid;place-items:center}",
    ".jpc-close:hover{background:#1E293B;color:#fff}",
    ".jpc-close svg{width:20px;height:20px}",
    ".jpc-body{flex:1;overflow-y:auto;padding:16px;background:#F8FAFC;display:flex;flex-direction:column;gap:10px}",
    ".jpc-msg{max-width:86%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:22px;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}",
    ".jpc-msg a{color:inherit;text-decoration:underline}",
    ".jpc-bot{align-self:flex-start;background:#fff;color:#0F172A;border:1px solid #E2E8F0;border-top-left-radius:4px}",
    ".jpc-user{align-self:flex-end;background:#0F172A;color:#fff;border-top-right-radius:4px}",
    ".jpc-typing{display:inline-flex;gap:4px;padding:14px}",
    ".jpc-typing i{width:6px;height:6px;border-radius:50%;background:#94A3B8;animation:jpc-dot 1s infinite}",
    ".jpc-typing i:nth-child(2){animation-delay:.15s}.jpc-typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes jpc-dot{0%,80%,100%{opacity:.3}40%{opacity:1}}",
    ".jpc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}",
    ".jpc-chip{padding:7px 12px;border:1px solid #CBD5E1;border-radius:9999px;background:#fff;color:#0F172A;font-size:13px;cursor:pointer}",
    ".jpc-chip:hover{background:#F1F5F9}",
    ".jpc-chip.lead{border-color:#E11D48;color:#E11D48;font-weight:600}",
    ".jpc-foot{padding:10px 12px 12px;border-top:1px solid #E2E8F0;background:#fff}",
    ".jpc-row{display:flex;gap:8px;align-items:flex-end}",
    ".jpc-input{flex:1;min-height:44px;max-height:120px;padding:11px 12px;border:1px solid #CBD5E1;border-radius:10px;font-size:14px;line-height:20px;resize:none;color:#0F172A;background:#fff}",
    ".jpc-input:focus,.jpc-field input:focus,.jpc-field textarea:focus{outline:none;border-color:#0F172A;box-shadow:0 0 0 2px rgba(15,23,42,.1)}",
    ".jpc-send{width:44px;height:44px;flex:none;border:0;border-radius:10px;background:#0F172A;color:#fff;cursor:pointer;display:grid;place-items:center}",
    ".jpc-send:disabled{background:#CBD5E1;cursor:default}",
    ".jpc-send svg{width:20px;height:20px}",
    ".jpc-actions{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}",
    ".jpc-leadbtn{flex:none;white-space:nowrap;padding:8px 12px;border:0;border-radius:8px;background:#FFE4E6;color:#BE123C;font-size:13px;font-weight:700;cursor:pointer}",
    ".jpc-note{font-size:11px;line-height:15px;color:#94A3B8}",
    ".jpc-form{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#fff}",
    ".jpc-form h3{margin:0;font-size:16px;line-height:22px;color:#0F172A}",
    ".jpc-form p{margin:0;font-size:13px;line-height:20px;color:#475569}",
    ".jpc-field{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;color:#0F172A}",
    ".jpc-field input,.jpc-field textarea{height:44px;padding:0 12px;border:1px solid #CBD5E1;border-radius:8px;font-size:14px;font-weight:400;color:#0F172A;background:#fff}",
    ".jpc-field textarea{height:88px;padding:10px 12px;resize:vertical}",
    ".jpc-req{color:#E11D48}",
    ".jpc-consent{display:flex;gap:8px;align-items:flex-start;padding:10px;border-radius:8px;background:#F8FAFC;font-size:12px;line-height:18px;color:#475569}",
    ".jpc-consent input{margin-top:2px;width:16px;height:16px;accent-color:#0F172A;flex:none}",
    ".jpc-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}",
    ".jpc-submit{height:46px;border:0;border-radius:8px;background:#E11D48;color:#fff;font-size:15px;font-weight:700;cursor:pointer}",
    ".jpc-submit:disabled{background:#FDA4AF}",
    ".jpc-back{align-self:flex-start;padding:0;border:0;background:transparent;color:#475569;font-size:13px;cursor:pointer;text-decoration:underline}",
    ".jpc-error{color:#BE123C;font-size:13px}",
    ".jpc-done{padding:14px;border-radius:10px;background:#ECFDF5;color:#065F46;font-size:14px;line-height:21px}",
    "@media (max-width:480px){.jpc-panel{right:0;bottom:0;width:100%;height:100%;border-radius:0;border:0}.jpc-launch{right:16px;bottom:16px;height:56px;padding:0 20px 0 16px;font-size:15px}.jpc-tip{right:16px;bottom:84px}}",
    "@media (prefers-reduced-motion:reduce){.jpc-launch::before,.jpc-typing i{animation:none}}",
  ].join("\n");

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  function store(kind) {
    try {
      return window[kind];
    } catch (e) {
      return null;
    }
  }
  function getItem(key) {
    try {
      var s = store("sessionStorage");
      return s ? s.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }
  function setItem(key, value) {
    try {
      var s = store("sessionStorage");
      if (s) s.setItem(key, value);
    } catch (e) {
      /* 저장소를 못 쓰는 환경이면 무시 */
    }
  }

  function newSessionId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }
  var sessionId = getItem("jpc-session") || newSessionId();
  setItem("jpc-session", sessionId);

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    for (var k in attrs || {}) node.setAttribute(k, attrs[k]);
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 답변 텍스트는 이스케이프한 뒤 링크·전화번호만 클릭할 수 있게 바꾼다.
  function linkify(text) {
    return escapeHtml(text)
      .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/010-3848-5949/g, '<a href="tel:01038485949">010-3848-5949</a>');
  }

  var history = []; // 서버로 보내는 대화 기록 (인사말 제외)
  var busy = false;
  var root, launcher, tip, panel, body, input, sendBtn, chatView, formView;

  function addMessage(role, text) {
    var msg = el("div", { class: "jpc-msg " + (role === "user" ? "jpc-user" : "jpc-bot") }, linkify(text));
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  function showTyping() {
    var t = el("div", { class: "jpc-msg jpc-bot jpc-typing", "aria-label": "답변 작성 중" }, "<i></i><i></i><i></i>");
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
    return t;
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value || !input.value.trim();
  }

  function ask(question) {
    question = (question || "").trim();
    if (!question || busy) return;
    if (question.length > MAX_LEN) question = question.slice(0, MAX_LEN);
    addMessage("user", question);
    input.value = "";
    autosize();
    setBusy(true);
    var typing = showTyping();

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId, message: question, history: history.slice(-8) }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (result) {
        var reply = result.data && (result.data.reply || result.data.error);
        if (!reply) throw new Error("empty");
        typing.remove();
        addMessage("bot", reply);
        if (result.ok && result.data.reply) {
          history.push({ role: "user", content: question }, { role: "assistant", content: reply });
        }
      })
      .catch(function () {
        typing.remove();
        addMessage(
          "bot",
          "연결이 원활하지 않습니다. 전화(" + PHONE + ")나 카카오톡 채널(" + KAKAO + ")로 문의해 주세요.",
        );
      })
      .then(function () {
        setBusy(false);
        input.focus();
      });
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    sendBtn.disabled = busy || !input.value.trim();
  }

  function buildChatView() {
    chatView = el("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0" });
    body = el("div", { class: "jpc-body", role: "log", "aria-live": "polite" });
    chatView.appendChild(body);

    addMessage("bot", GREETING);
    var chips = el("div", { class: "jpc-chips" });
    SUGGESTIONS.forEach(function (q) {
      var chip = el("button", { type: "button", class: "jpc-chip" });
      chip.textContent = q;
      chip.addEventListener("click", function () {
        ask(q);
      });
      chips.appendChild(chip);
    });
    var leadChip = el("button", { type: "button", class: "jpc-chip lead" });
    leadChip.textContent = "상담 신청하기";
    leadChip.addEventListener("click", showForm);
    chips.appendChild(leadChip);
    body.appendChild(chips);

    var foot = el("div", { class: "jpc-foot" });
    var row = el("div", { class: "jpc-row" });
    input = el("textarea", {
      class: "jpc-input",
      rows: "1",
      maxlength: String(MAX_LEN),
      placeholder: "궁금한 점을 입력해 주세요",
      "aria-label": "질문 입력",
    });
    sendBtn = el("button", { type: "button", class: "jpc-send", "aria-label": "보내기" }, ICON_SEND);
    sendBtn.disabled = true;
    row.appendChild(input);
    row.appendChild(sendBtn);
    foot.appendChild(row);

    var actions = el("div", { class: "jpc-actions" });
    var leadBtn = el("button", { type: "button", class: "jpc-leadbtn" });
    leadBtn.textContent = "상담 신청";
    leadBtn.addEventListener("click", showForm);
    var note = el("span", { class: "jpc-note" });
    note.textContent = "안내는 참고용이며 법률·세무 판단은 전문가 확인이 필요합니다. 대화는 상담 품질 확인을 위해 저장됩니다.";
    actions.appendChild(leadBtn);
    actions.appendChild(note);
    foot.appendChild(actions);
    chatView.appendChild(foot);

    input.addEventListener("input", autosize);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        ask(input.value);
      }
    });
    sendBtn.addEventListener("click", function () {
      ask(input.value);
    });
    return chatView;
  }

  function field(label, name, type, required, extra) {
    var wrap = el("label", { class: "jpc-field" });
    wrap.innerHTML = "<span>" + escapeHtml(label) + (required ? ' <span class="jpc-req">*</span>' : "") + "</span>";
    var control =
      type === "textarea"
        ? el("textarea", Object.assign({ name: name }, extra || {}))
        : el("input", Object.assign({ name: name, type: type }, extra || {}));
    if (required) control.required = true;
    wrap.appendChild(control);
    return wrap;
  }

  function buildFormView() {
    formView = el("form", { class: "jpc-form", novalidate: "" });
    formView.style.display = "none";
    var back = el("button", { type: "button", class: "jpc-back" });
    back.textContent = "← 채팅으로 돌아가기";
    back.addEventListener("click", showChat);
    var title = el("h3");
    title.textContent = "상담 신청";
    var desc = el("p");
    desc.textContent = "이름과 연락처(또는 이메일)를 남겨 주시면 확인 후 연락드립니다.";
    formView.appendChild(back);
    formView.appendChild(title);
    formView.appendChild(desc);
    formView.appendChild(field("이름", "name", "text", true, { maxlength: "50", autocomplete: "name" }));
    formView.appendChild(field("연락처", "phone", "tel", false, { maxlength: "20", autocomplete: "tel", placeholder: "010-0000-0000" }));
    formView.appendChild(field("이메일", "email", "email", false, { maxlength: "120", autocomplete: "email" }));
    formView.appendChild(field("회사·상호 (공인중개사·분양 관계자)", "company", "text", false, { maxlength: "100" }));
    formView.appendChild(field("문의 내용", "message", "textarea", false, { maxlength: "2000", placeholder: "관심 지역, 매물 종류, 촬영 일정 등" }));

    var hp = el("div", { class: "jpc-hp", "aria-hidden": "true" });
    hp.innerHTML = '<input type="text" name="website" tabindex="-1" autocomplete="off">';
    formView.appendChild(hp);

    var consent = el("label", { class: "jpc-consent" });
    consent.innerHTML =
      '<input type="checkbox" name="consent" required>' +
      "<span><b>개인정보 수집·이용 동의 (필수)</b><br>수집 항목: 이름, 연락처, 이메일, 회사·상호, 문의 내용<br>이용 목적: 상담 신청 확인 및 회신<br>보유 기간: 상담 목적 달성 시까지 (법령에 보존 의무가 있으면 그 기간)</span>";
    formView.appendChild(consent);

    var error = el("div", { class: "jpc-error", role: "alert" });
    var submit = el("button", { type: "submit", class: "jpc-submit" });
    submit.textContent = "상담 신청하기";
    formView.appendChild(error);
    formView.appendChild(submit);

    formView.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formView.elements;
      var payload = {
        name: f.name.value,
        phone: f.phone.value,
        email: f.email.value,
        company: f.company.value,
        message: f.message.value,
        consent: f.consent.checked,
        website: f.website.value,
      };
      error.textContent = "";
      if (!payload.name.trim()) return (error.textContent = "이름을 입력해 주세요.");
      if (!payload.phone.trim() && !payload.email.trim())
        return (error.textContent = "연락처나 이메일 중 하나는 꼭 입력해 주세요.");
      if (!payload.consent) return (error.textContent = "개인정보 수집·이용에 동의해 주세요.");

      submit.disabled = true;
      submit.textContent = "접수 중…";
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) throw new Error((result.data && result.data.error) || "접수 실패");
          formView.innerHTML = "";
          var done = el("div", { class: "jpc-done", role: "status" });
          done.textContent = "상담 신청이 접수되었습니다. 남겨 주신 연락처로 확인 후 연락드리겠습니다.";
          var again = el("button", { type: "button", class: "jpc-back" });
          again.textContent = "← 채팅으로 돌아가기";
          again.addEventListener("click", showChat);
          formView.appendChild(done);
          formView.appendChild(again);
        })
        .catch(function (err) {
          error.textContent = err.message || "접수 중 문제가 생겼습니다. 전화(" + PHONE + ")로 문의해 주세요.";
          submit.disabled = false;
          submit.textContent = "상담 신청하기";
        });
    });
    return formView;
  }

  function showForm() {
    chatView.style.display = "none";
    if (!formView.querySelector("input[name=name]")) {
      panel.removeChild(formView);
      panel.appendChild(buildFormView());
    }
    formView.style.display = "flex";
    var first = formView.querySelector("input[name=name]");
    if (first) first.focus();
  }

  function showChat() {
    formView.style.display = "none";
    chatView.style.display = "flex";
    input.focus();
  }

  function open() {
    if (!panel) buildPanel();
    hideTip();
    panel.style.display = "flex";
    launcher.style.display = "none";
    launcher.setAttribute("aria-expanded", "true");
    setTimeout(function () {
      (chatView.style.display === "none" ? formView.querySelector("input") : input).focus();
    }, 0);
  }

  function close() {
    panel.style.display = "none";
    launcher.style.display = "flex";
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  function buildPanel() {
    panel = el("div", { class: "jpc-panel", role: "dialog", "aria-label": "JP이야기 상담 챗봇" });
    var head = el("div", { class: "jpc-head" });
    head.innerHTML =
      '<span class="jpc-avatar">JP</span><span><div class="jpc-title">JP이야기 상담 안내</div><div class="jpc-sub">중개 · 컨설팅 · 촬영 협업 문의</div></span>';
    var closeBtn = el("button", { type: "button", class: "jpc-close", "aria-label": "챗봇 닫기" }, ICON_CLOSE);
    closeBtn.addEventListener("click", close);
    head.appendChild(closeBtn);
    panel.appendChild(head);
    panel.appendChild(buildChatView());
    panel.appendChild(buildFormView());
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
    root.appendChild(panel);
  }

  function hideTip() {
    if (tip) {
      tip.remove();
      tip = null;
    }
    setItem("jpc-tip-seen", "1");
  }

  function init() {
    var style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    root = el("div", { class: "jpc" });
    launcher = el("button", {
      type: "button",
      class: "jpc-launch",
      "aria-label": "상담 챗봇 열기",
      "aria-expanded": "false",
    });
    launcher.innerHTML = ICON_CHAT + "<span>상담 챗봇</span><span class=\"jpc-badge\" aria-hidden=\"true\"></span>";
    launcher.addEventListener("click", open);
    root.appendChild(launcher);
    document.body.appendChild(root);

    if (!getItem("jpc-tip-seen")) {
      setTimeout(function () {
        if (panel && panel.style.display !== "none") return;
        tip = el("div", { class: "jpc-tip", role: "status" });
        tip.innerHTML = "궁금한 점을 바로 물어보세요.<br>중개보수·촬영 협업·상담 신청 안내";
        var x = el("button", { type: "button", "aria-label": "안내 닫기" }, "×");
        x.addEventListener("click", hideTip);
        tip.appendChild(x);
        root.appendChild(tip);
      }, 2500);
    }
  }

  window.JPChat = { open: function () { if (root) open(); }, openForm: function () { if (root) { open(); showForm(); } } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
