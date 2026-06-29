(function () {
  const script = document.currentScript;

  if (!script) {
    return;
  }

  const botId = script.dataset.botId || "dra-renata-reis";
  const clientId = script.dataset.clientId || "unknown-client";
  const appOrigin = script.dataset.appOrigin || new URL(script.src).origin;
  const apiBaseUrl = script.dataset.apiBaseUrl || appOrigin;
  const rootId = `imagin-widget-${botId}-${clientId}`;

  if (document.getElementById(rootId)) {
    return;
  }

  let buttonTexts = [script.dataset.buttonText || "Iniciar atendimento"];

  const root = document.createElement("div");
  root.id = rootId;
  document.body.appendChild(root);

  const mount = root.attachShadow ? root.attachShadow({ mode: "open" }) : root;
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .imagin-launcher {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483000;
      max-width: min(360px, calc(100vw - 40px));
      border: 0;
      border-radius: 999px;
      background: #205ea8;
      color: #ffffff;
      box-shadow: 0 12px 30px rgba(14, 31, 53, 0.24);
      cursor: pointer;
      font: 600 14px/1.35 Arial, Helvetica, sans-serif;
      padding: 13px 18px;
      text-align: left;
    }
    .imagin-panel {
      position: fixed;
      right: 20px;
      bottom: 82px;
      z-index: 2147483000;
      width: min(420px, calc(100vw - 40px));
      max-height: min(720px, calc(100vh - 110px));
      display: none;
      overflow: hidden;
      border: 1px solid #d8deea;
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 20px 60px rgba(14, 31, 53, 0.28);
    }
    .imagin-panel[data-open="true"] { display: block; }
    .imagin-close {
      position: absolute;
      right: 8px;
      top: 8px;
      z-index: 2;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: #172033;
      cursor: pointer;
      font: 700 18px/1 Arial, Helvetica, sans-serif;
    }
    .imagin-frame {
      width: 100%;
      height: min(640px, calc(100vh - 112px));
      min-height: 560px;
      border: 0;
      display: block;
      background: #ffffff;
    }
    @media (max-width: 480px) {
      .imagin-launcher {
        right: 12px;
        bottom: 12px;
        max-width: calc(100vw - 24px);
      }
      .imagin-panel {
        right: 8px;
        left: 8px;
        bottom: 72px;
        width: auto;
        max-height: calc(100vh - 84px);
      }
      .imagin-frame {
        height: calc(100vh - 84px);
      }
    }
  `;

  const panel = document.createElement("div");
  panel.className = "imagin-panel";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "imagin-close";
  close.setAttribute("aria-label", "Fechar atendimento");
  close.textContent = "×";

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "imagin-launcher";
  launcher.textContent = buttonTexts[0];

  let iframe = null;
  let textIndex = 0;

  function ensureIframe() {
    if (iframe) {
      return iframe;
    }

    const url = new URL(`/chatbots/${encodeURIComponent(botId)}/embed`, appOrigin);
    url.searchParams.set("clientId", clientId);
    url.searchParams.set("parentOrigin", window.location.origin);
    url.searchParams.set("pageUrl", window.location.href);

    iframe = document.createElement("iframe");
    iframe.className = "imagin-frame";
    iframe.title = "Assistente de agendamento";
    iframe.src = url.toString();
    iframe.allow = "clipboard-write";
    iframe.sandbox = "allow-forms allow-popups allow-same-origin allow-scripts";
    panel.appendChild(iframe);

    return iframe;
  }

  function openPanel() {
    ensureIframe();
    panel.dataset.open = "true";
    launcher.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    panel.dataset.open = "false";
    launcher.setAttribute("aria-expanded", "false");
  }

  launcher.addEventListener("click", function () {
    if (panel.dataset.open === "true") {
      closePanel();
      return;
    }

    openPanel();
  });

  close.addEventListener("click", closePanel);

  window.setInterval(function () {
    if (panel.dataset.open === "true") {
      return;
    }

    textIndex = (textIndex + 1) % buttonTexts.length;
    launcher.textContent = buttonTexts[textIndex];
  }, 4500);

  window.addEventListener("message", function (event) {
    if (!iframe || event.source !== iframe.contentWindow) {
      return;
    }

    const data = event.data;

    if (!data || data.type !== "imagin:resize") {
      return;
    }

    const height = Number(data.height);

    if (Number.isFinite(height)) {
      iframe.style.height = `${Math.min(Math.max(height, 560), 720)}px`;
    }
  });

  fetch(`${apiBaseUrl}/api/public/chatbots/${encodeURIComponent(botId)}/config`)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Chatbot config request failed");
      }

      return response.json();
    })
    .then(function (body) {
      if (
        body &&
        body.chatbot &&
        Array.isArray(body.chatbot.buttonTexts) &&
        body.chatbot.buttonTexts.length > 0
      ) {
        buttonTexts = body.chatbot.buttonTexts;
        textIndex = 0;
        launcher.textContent = buttonTexts[0];
      }
    })
    .catch(function () {
      // Keep the generic launcher text when public config is unavailable.
    });

  panel.appendChild(close);
  mount.appendChild(style);
  mount.appendChild(panel);
  mount.appendChild(launcher);
})();
