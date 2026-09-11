(() => {
  const DATA_URL = "/field-notes/notes.json";

  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);

  const inlineMarkdown = value => escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const markdownToHtml = markdown => {
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    let html = "";
    let paragraph = [];
    let listType = null;

    const closeParagraph = () => {
      if (paragraph.length) {
        html += `<p>${paragraph.map(inlineMarkdown).join(" ")}</p>`;
        paragraph = [];
      }
    };
    const closeList = () => {
      if (listType) {
        html += `</${listType}>`;
        listType = null;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        closeParagraph();
        closeList();
        continue;
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
      const bullet = trimmed.match(/^[-*]\s+(.+)$/);

      if (heading) {
        closeParagraph();
        closeList();
        const level = heading[1].length + 1;
        html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
      } else if (trimmed.startsWith("> ")) {
        closeParagraph();
        closeList();
        html += `<blockquote class="field-promise">${inlineMarkdown(trimmed.slice(2))}</blockquote>`;
      } else if (numbered || bullet) {
        closeParagraph();
        const nextType = numbered ? "ol" : "ul";
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          html += `<${listType} class="field-practice">`;
        }
        html += `<li>${inlineMarkdown((numbered || bullet)[1])}</li>`;
      } else {
        closeList();
        paragraph.push(trimmed);
      }
    }

    closeParagraph();
    closeList();
    return html;
  };

  const readableDate = date => {
    if (!date) return "";
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isNaN(parsed.getTime())
      ? escapeHtml(date)
      : parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const noteUrl = slug => `/field-notes/note?slug=${encodeURIComponent(slug)}`;

  const card = note => `
    <article class="field-note-card">
      <p class="field-note-card-meta">Field Note No. ${escapeHtml(note.number)}${note.category ? ` · ${escapeHtml(note.category)}` : ""}</p>
      <h3><a href="${noteUrl(note.slug)}">${escapeHtml(note.title)}</a></h3>
      <p>${escapeHtml(note.summary)}</p>
      <div class="field-note-card-footer">
        <time datetime="${escapeHtml(note.date)}">${readableDate(note.date)}</time>
        <a href="${noteUrl(note.slug)}">Read the note <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;

  const showMessage = (target, message) => {
    target.innerHTML = `<p class="field-notes-message">${escapeHtml(message)}</p>`;
  };

  const loadNotes = async () => {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Field Notes could not be loaded.");
    const notes = await response.json();
    return notes
      .filter(note => note.published === true)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  };

  const renderLists = notes => {
    const preview = document.querySelector("#field-notes-list");
    if (preview) {
      preview.innerHTML = notes.length
        ? notes.slice(0, 3).map(card).join("")
        : '<p class="field-notes-message">No Field Notes have moved outward yet.</p>';
    }

    const archive = document.querySelector("#field-notes-archive");
    if (archive) {
      archive.innerHTML = notes.length
        ? notes.map(card).join("")
        : '<p class="field-notes-message">No Field Notes have moved outward yet.</p>';
    }
  };

  const renderDetail = notes => {
    const target = document.querySelector("#field-note-detail");
    if (!target) return;

    const slug = new URLSearchParams(window.location.search).get("slug");
    const note = notes.find(item => item.slug === slug);

    if (!note) {
      showMessage(target, "This Field Note could not be found.");
      return;
    }

    document.title = `${note.title} — Megan Leisey`;
    target.innerHTML = `
      <article class="field-note field-note-detail">
        <p class="field-note-card-meta">Field Note No. ${escapeHtml(note.number)}${note.category ? ` · ${escapeHtml(note.category)}` : ""}</p>
        <h1>${escapeHtml(note.title)}</h1>
        <p class="note-date"><time datetime="${escapeHtml(note.date)}">${readableDate(note.date)}</time></p>
        ${note.image ? `<figure class="field-note-image"><img src="${escapeHtml(note.image)}" alt="${escapeHtml(note.imageAlt || "")}"></figure>` : ""}
        <p class="note-lede">${escapeHtml(note.summary)}</p>
        <div class="field-note-body">${markdownToHtml(note.body)}</div>
        ${note.recognition ? `<div class="field-recognition">✦ Field recognition<br><strong>${escapeHtml(note.recognition)}</strong></div>` : ""}
        <div class="present-conditions">
          <h2>Present Conditions ☕📖☾</h2>
          ${note.filedUnder ? `<p><b>Filed under:</b> ${escapeHtml(note.filedUnder)}</p>` : ""}
          ${note.status ? `<p><b>Current status:</b> ${escapeHtml(note.status)}</p>` : ""}
        </div>
        ${note.location ? `<div class="note-meta">Location: ${escapeHtml(note.location)}</div>` : ""}
      </article>`;
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const targets = [...document.querySelectorAll("#field-notes-list, #field-notes-archive, #field-note-detail")];
    if (!targets.length) return;

    try {
      const notes = await loadNotes();
      renderLists(notes);
      renderDetail(notes);
    } catch (error) {
      targets.forEach(target => showMessage(target, "The Field Notes are resting for a moment. Please return soon."));
    }
  });
})();
