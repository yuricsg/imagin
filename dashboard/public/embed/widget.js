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
  const DEFAULT_TEASER = "Olá! Posso te ajudar?";
  const DEFAULT_AVATAR = `${appOrigin.replace(/\/$/, "")}/embed/robot-helper.png`;

  if (document.getElementById(rootId)) {
    return;
  }

  let teaserTexts = [script.dataset.buttonText || DEFAULT_TEASER];
  let avatarUrl = DEFAULT_AVATAR;

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
      display: flex;
      align-items: flex-end;
      gap: 10px;
      max-width: min(420px, calc(100vw - 40px));
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      font: 500 14px/1.4 Arial, Helvetica, sans-serif;
      text-align: left;
      color: #18181b;
    }
    .imagin-launcher:focus-visible {
      outline: 2px solid #6366f1;
      outline-offset: 4px;
      border-radius: 16px;
    }
    .imagin-bubble {
      position: relative;
      max-width: min(280px, calc(100vw - 120px));
      padding: 12px 14px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 10px 28px rgba(24, 24, 27, 0.18);
      color: #18181b;
    }
    .imagin-bubble::after {
      content: "";
      position: absolute;
      right: -7px;
      bottom: 18px;
      width: 14px;
      height: 14px;
      background: #ffffff;
      transform: rotate(45deg);
      box-shadow: 3px -3px 8px rgba(24, 24, 27, 0.06);
    }
    .imagin-bubble-text {
      display: block;
      font: 500 14px/1.4 Arial, Helvetica, sans-serif;
      color: #18181b;
    }
    .imagin-bubble-text strong,
    .imagin-bubble-text b {
      font-weight: 700;
    }
    .imagin-avatar-wrap {
      position: relative;
      flex-shrink: 0;
      width: 56px;
      height: 56px;
    }
    .imagin-avatar {
      display: block;
      width: 56px;
      height: 56px;
      border-radius: 999px;
      object-fit: cover;
      background: #e0e7ff;
      box-shadow: 0 8px 20px rgba(24, 24, 27, 0.2);
      border: 2px solid #ffffff;
    }
    .imagin-online {
      position: absolute;
      right: 2px;
      bottom: 2px;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: #10b981;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.25);
    }
    .imagin-launcher[aria-expanded="true"] .imagin-bubble {
      display: none;
    }
    .imagin-panel {
      position: fixed;
      right: 20px;
      bottom: 92px;
      z-index: 2147483000;
      width: min(420px, calc(100vw - 40px));
      max-height: min(720px, calc(100vh - 120px));
      display: none;
      overflow: hidden;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 20px 60px rgba(24, 24, 27, 0.28);
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
      color: #18181b;
      cursor: pointer;
      font: 700 18px/1 Arial, Helvetica, sans-serif;
    }
    .imagin-frame {
      width: 100%;
      height: min(640px, calc(100vh - 122px));
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
      .imagin-bubble {
        max-width: calc(100vw - 100px);
      }
      .imagin-panel {
        right: 8px;
        left: 8px;
        bottom: 84px;
        width: auto;
        max-height: calc(100vh - 96px);
      }
      .imagin-frame {
        height: calc(100vh - 96px);
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
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-label", "Abrir atendimento");

  const bubble = document.createElement("span");
  bubble.className = "imagin-bubble";

  const bubbleText = document.createElement("span");
  bubbleText.className = "imagin-bubble-text";
  bubbleText.textContent = teaserTexts[0];
  bubble.appendChild(bubbleText);

  const avatarWrap = document.createElement("span");
  avatarWrap.className = "imagin-avatar-wrap";

  const avatar = document.createElement("img");
  avatar.className = "imagin-avatar";
  avatar.alt = "";
  avatar.width = 56;
  avatar.height = 56;
  avatar.decoding = "async";
  avatar.src = avatarUrl;

  const online = document.createElement("span");
  online.className = "imagin-online";
  online.setAttribute("aria-hidden", "true");

  avatarWrap.appendChild(avatar);
  avatarWrap.appendChild(online);
  launcher.appendChild(bubble);
  launcher.appendChild(avatarWrap);

  let iframe = null;
  let textIndex = 0;

  function ensureIframe() {
    if (iframe) {
      return iframe;
    }

    const url = new URL(`/chatbots/${encodeURIComponent(botId)}/embed`, appOrigin);
    const attribution = collectAttribution();

    url.searchParams.set("clientId", clientId);
    url.searchParams.set("parentOrigin", window.location.origin);
    url.searchParams.set("pageUrl", window.location.href);
    url.searchParams.set("attribution", JSON.stringify(attribution));

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
    if (panel.dataset.open === "true" || teaserTexts.length < 2) {
      return;
    }

    textIndex = (textIndex + 1) % teaserTexts.length;
    bubbleText.textContent = teaserTexts[textIndex];
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
      const chatbot = body && body.chatbot ? body.chatbot : null;
      if (!chatbot) return;

      const launcherConfig = chatbot.launcher;
      const fromLauncher =
        launcherConfig &&
        Array.isArray(launcherConfig.teaserTexts) &&
        launcherConfig.teaserTexts.length > 0
          ? launcherConfig.teaserTexts.filter(function (entry) {
              return typeof entry === "string" && entry.trim();
            })
          : null;
      const fromButtons =
        Array.isArray(chatbot.buttonTexts) && chatbot.buttonTexts.length > 0
          ? chatbot.buttonTexts.filter(function (entry) {
              return typeof entry === "string" && entry.trim();
            })
          : null;

      if (fromLauncher || fromButtons) {
        teaserTexts = fromLauncher || fromButtons;
        textIndex = 0;
        bubbleText.textContent = teaserTexts[0];
      }

      if (
        launcherConfig &&
        typeof launcherConfig.avatarUrl === "string" &&
        launcherConfig.avatarUrl.trim()
      ) {
        avatarUrl = launcherConfig.avatarUrl.trim();
        avatar.src = avatarUrl;
      }
    })
    .catch(function () {
      // Keep the default teaser/avatar when public config is unavailable.
    });

  panel.appendChild(close);
  mount.appendChild(style);
  mount.appendChild(panel);
  mount.appendChild(launcher);

  function collectAttribution() {
    const currentUrl = new URL(window.location.href);
    const landingPageUrl = getLandingPageUrl();

    return {
      pageUrl: window.location.href,
      landingPageUrl,
      referrer: document.referrer || undefined,
      parentOrigin: window.location.origin,
      utm: compactObject({
        source: currentUrl.searchParams.get("utm_source"),
        medium: currentUrl.searchParams.get("utm_medium"),
        campaign: currentUrl.searchParams.get("utm_campaign"),
        content: currentUrl.searchParams.get("utm_content"),
        term: currentUrl.searchParams.get("utm_term"),
        id: currentUrl.searchParams.get("utm_id"),
      }),
      clickIds: compactObject({
        fbclid: currentUrl.searchParams.get("fbclid"),
        gclid: currentUrl.searchParams.get("gclid"),
        gbraid: currentUrl.searchParams.get("gbraid"),
        wbraid: currentUrl.searchParams.get("wbraid"),
        msclkid: currentUrl.searchParams.get("msclkid"),
      }),
      cookies: compactObject({
        fbp: readCookie("_fbp"),
        fbc: readCookie("_fbc") || buildFbcFromFbclid(currentUrl),
        gaClientId: readGaClientId(),
      }),
    };
  }

  function getLandingPageUrl() {
    try {
      const key = "imagin:landingPageUrl";
      const stored = window.sessionStorage.getItem(key);

      if (stored) {
        return stored;
      }

      window.sessionStorage.setItem(key, window.location.href);
      return window.location.href;
    } catch {
      return window.location.href;
    }
  }

  function readCookie(name) {
    return document.cookie
      .split(";")
      .map(function (entry) {
        return entry.trim();
      })
      .find(function (entry) {
        return entry.startsWith(`${name}=`);
      })
      ?.split("=")
      .slice(1)
      .join("=") || undefined;
  }

  function readGaClientId() {
    const gaCookie = readCookie("_ga");

    if (!gaCookie) {
      return undefined;
    }

    const parts = gaCookie.split(".");
    const clientIdParts = parts.slice(-2);

    return clientIdParts.length === 2 ? clientIdParts.join(".") : undefined;
  }

  function buildFbcFromFbclid(currentUrl) {
    const fbclid = currentUrl.searchParams.get("fbclid");

    if (!fbclid) {
      return undefined;
    }

    return `fb.1.${Date.now()}.${fbclid}`;
  }

  function compactObject(value) {
    return Object.fromEntries(
      Object.entries(value).filter(function (entry) {
        return entry[1] !== undefined && entry[1] !== null && entry[1] !== "";
      }),
    );
  }
})();
