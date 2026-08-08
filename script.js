(() => {
  const config = window.PUBLIC_JOURNAL_CONFIG || {};
  const page = document.body.dataset.page;

  if (
    !config.supabaseUrl ||
    !config.supabaseKey ||
    config.supabaseUrl.includes("PASTE_YOUR") ||
    config.supabaseKey.includes("PASTE_YOUR")
  ) {
    console.error("Supabase is not configured. Edit config.js.");
    showText("status", "Supabase is not configured yet. Edit config.js.");
    showText("write-status", "Supabase is not configured yet. Edit config.js.");
    showText("entry-status", "Supabase is not configured yet. Edit config.js.");
    return;
  }

  const { createClient } = window.supabase;
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  const MAX_CONTENT = 20000;

  function showText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function formatDate(value) {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function getPlainText(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
  }

  function excerpt(html, length = 180) {
    const text = getPlainText(html);
    return text.length > length ? text.slice(0, length).trim() + "..." : text;
  }

  async function loadFeed() {
    const list = document.getElementById("journal-list");
    if (!list) return;

    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, title, content, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      showText("status", "Could not load the journal. Check your Supabase settings and RLS policies.");
      return;
    }

    showText("status", data.length ? "" : "No journal entries yet.");

    list.innerHTML = "";

    data.forEach((entry) => {
  const card = document.createElement("article");
  card.className = "journal-card";

  card.innerHTML = `
    <div class="journal-card-content">

      <div class="posted">
        ${escapeHTML(formatDate(entry.created_at))}
      </div>

      <h2 class="journal-card-title">
        ${escapeHTML(entry.title)}
      </h2>

      <div class="journal-card-anonymous">
        Anonymous
      </div>

      <p class="journal-card-preview">
        ${escapeHTML(excerpt(entry.content))}
      </p>

      <a
        class="read-button"
        href="journal.html?id=${encodeURIComponent(entry.id)}"
      >
        READ JOURNAL
      </a>

    </div>
  `;

  list.appendChild(card);
});
  }

  function setupToolbar() {
    document.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());

      button.addEventListener("click", () => {
        const command = button.dataset.command;
        document.execCommand(command, false, null);
        document.getElementById("editor")?.focus();
        updateCounter();
      });
    });
  }

  function updateCounter() {
    const editor = document.getElementById("editor");
    const counter = document.getElementById("counter");
    if (!editor || !counter) return;

    const count = (editor.innerText || "").length;
    counter.textContent = `${count} / ${MAX_CONTENT}`;

    counter.classList.toggle("limit-warning", count > MAX_CONTENT * 0.9);
  }

  function setupEditor() {
    const editor = document.getElementById("editor");
    const title = document.getElementById("title");
    const postButton = document.getElementById("post-button");
    const status = document.getElementById("write-status");

    if (!editor || !title || !postButton) return;

    setupToolbar();
    updateCounter();

    editor.addEventListener("input", () => {
      const text = editor.innerText || "";
      if (text.length > MAX_CONTENT) {
        const selection = window.getSelection();
        editor.innerText = text.slice(0, MAX_CONTENT);
        if (selection) {
          selection.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.addRange(range);
        }
      }
      updateCounter();
    });

    postButton.addEventListener("click", async () => {
      const cleanTitle = title.value.trim();
      const rawContent = editor.innerHTML.trim();
      const plainContent = getPlainText(rawContent);

      if (!cleanTitle) {
        status.textContent = "Please enter a title.";
        title.focus();
        return;
      }

      if (!plainContent) {
        status.textContent = "Please write something first.";
        editor.focus();
        return;
      }

      if (plainContent.length > MAX_CONTENT) {
        status.textContent = "Your entry is too long.";
        return;
      }

      const cleanContent = DOMPurify.sanitize(rawContent, {
        ALLOWED_TAGS: [
          "b", "strong", "i", "em", "u", "p", "br",
          "div", "blockquote", "ul", "ol", "li"
        ],
        ALLOWED_ATTR: []
      });

      postButton.disabled = true;
      status.textContent = "Posting...";

      const { data, error } = await supabase
        .from("journal_entries")
        .insert({
          title: cleanTitle,
          content: cleanContent
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        status.textContent =
          "Posting failed. Check your Supabase URL/key, table permissions, and RLS policies.";
        postButton.disabled = false;
        return;
      }

      window.location.href = "index.html";
    });
  }

  async function loadSingleEntry() {
    const entry = document.getElementById("entry");
    if (!entry) return;

    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
      showText("entry-status", "No journal entry was specified.");
      return;
    }

    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, title, content, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error(error);
      showText("entry-status", "This journal entry could not be found.");
      return;
    }

    const safeContent = DOMPurify.sanitize(data.content || "", {
      ALLOWED_TAGS: [
        "b", "strong", "i", "em", "u", "p", "br",
        "div", "blockquote", "ul", "ol", "li"
      ],
      ALLOWED_ATTR: []
    });

    entry.innerHTML = `
      <div class="entry-meta">Posted: ${escapeHTML(formatDate(data.created_at))}</div>
      <h1>${escapeHTML(data.title)}</h1>
      <div class="anonymous">Anonymous</div>
      <hr>
      <div class="entry-content">${safeContent}</div>
      <div class="entry-bottom">This entry is read-only.</div>
    `;
  }

  if (page === "home") loadFeed();
  if (page === "write") setupEditor();
  if (page === "journal") loadSingleEntry();
})();
