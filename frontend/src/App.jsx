import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";


import ReactMarkdown from "react-markdown";

const API = "http://localhost:5000/api";
const AUTOSAVE_DELAY = 1200;

export default function App() {

  /* =====================================================
     STATE
     ===================================================== */

  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);

  const [title, setTitle] = useState("Welcome");

  const [content, setContent] = useState(
    "# Welcome\n\nStart writing your Markdown knowledge base."
  );

  const [query, setQuery] = useState("");

  const [message, setMessage] = useState("Loading...");

  const [saving, setSaving] = useState(false);

  const [dirty, setDirty] = useState(false);

  const [showLog, setShowLog] = useState(false);

  const [gitLog, setGitLog] = useState([]);


  /* =====================================================
     DARK / LIGHT MODE
     ===================================================== */

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("gitwiki-theme") !== "light";
  });


  /* =====================================================
     SAVE THEME PREFERENCE
     ===================================================== */

  useEffect(() => {

    localStorage.setItem(
      "gitwiki-theme",
      darkMode ? "dark" : "light"
    );

  }, [darkMode]);


  /* =====================================================
     REFS
     ===================================================== */

  const saveTimer = useRef(null);

  const saveInProgress = useRef(false);

  const dirtyRef = useRef(false);


  /* =====================================================
     KEEP DIRTY REF UPDATED
     ===================================================== */

  useEffect(() => {

    dirtyRef.current = dirty;

  }, [dirty]);


  /* =====================================================
     LOAD NOTES
     ===================================================== */

  async function loadNotes() {

    try {

      const res = await fetch(`${API}/notes`);

      if (!res.ok) {
        throw new Error("Backend is not responding");
      }

      const data = await res.json();

      setNotes(data);


      setSelected((current) => {

        /*
          If the currently selected note still exists,
          keep it selected.
        */

        if (
          current &&
          data.some((n) => n.filename === current)
        ) {
          return current;
        }


        /*
          Otherwise select the first note.
        */

        if (data.length) {

          setTitle(data[0].title);

          setContent(data[0].content);

          setMessage(
            "Ready — changes are committed automatically"
          );

          return data[0].filename;
        }


        return current;

      });


      if (!data.length) {

        setMessage(
          "Start typing — your note will be saved automatically"
        );

      }

    } catch (e) {

      setMessage(`✕ ${e.message}`);

    }

  }


  /* =====================================================
     LOAD NOTES WHEN APP STARTS
     ===================================================== */

  useEffect(() => {

    loadNotes();

    return () => {

      clearTimeout(saveTimer.current);

    };

  }, []);


  /* =====================================================
     OPEN EXISTING NOTE
     ===================================================== */

  function openNote(note) {

    clearTimeout(saveTimer.current);

    setSelected(note.filename);

    setTitle(note.title);

    setContent(note.content);

    setDirty(false);

    dirtyRef.current = false;

    setMessage(
      "Ready — changes are committed automatically"
    );

  }


  /* =====================================================
     CREATE NEW NOTE
     ===================================================== */

  function newNote() {

    clearTimeout(saveTimer.current);

    setSelected(null);

    setTitle("New Note");

    setContent("");

    setDirty(false);

    dirtyRef.current = false;

    setMessage(
      "Start typing — your note will be saved automatically"
    );

  }


  /* =====================================================
     MARK NOTE AS CHANGED
     ===================================================== */

  function markChanged() {

    setDirty(true);

    dirtyRef.current = true;

    setMessage("Unsaved changes…");

  }


  /* =====================================================
     SAVE NOTE
     ===================================================== */

  async function saveNote() {

    /*
      Don't start another save while one is already running.
    */

    if (
      saveInProgress.current ||
      !dirtyRef.current ||
      !title.trim()
    ) {
      return;
    }


    saveInProgress.current = true;

    setSaving(true);

    setMessage(
      "Saving and committing to Git…"
    );


    try {

      const res = await fetch(`${API}/notes`, {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          title,

          content,

          filename: selected

        })

      });


      const data = await res.json();


      if (!res.ok) {

        throw new Error(
          data.error || "Save failed"
        );

      }


      /*
        Update selected filename after saving.
      */

      setSelected(data.filename);

      setDirty(false);

      dirtyRef.current = false;

      setMessage(
        "✓ Automatically saved and committed to Git"
      );


      /*
        Reload notes so sidebar stays updated.
      */

      await loadNotes();

    } catch (e) {

      setMessage(`✕ ${e.message}`);

    } finally {

      saveInProgress.current = false;

      setSaving(false);


      /*
        If user typed while saving was happening,
        schedule another save.
      */

      if (dirtyRef.current) {

        scheduleSave();

      }

    }

  }


  /* =====================================================
     SCHEDULE AUTOMATIC SAVE
     ===================================================== */

  function scheduleSave() {

    clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {

      saveNote();

    }, AUTOSAVE_DELAY);

  }


  /* =====================================================
     WATCH FOR CHANGES
     ===================================================== */

  useEffect(() => {

    if (!dirty) {
      return;
    }

    scheduleSave();

    return () => {

      clearTimeout(saveTimer.current);

    };

  }, [dirty, title, content]);


  /* =====================================================
     DELETE NOTE
     ===================================================== */

  async function deleteNote() {

    /*
      Don't do anything if there is no selected note.
    */

    if (!selected) {

      setMessage(
        "There is no saved note to delete."
      );

      return;

    }


    /*
      Ask for confirmation.
    */

    const confirmed = window.confirm(
      "Delete this note?\n\nGit will keep the deletion in history."
    );


    if (!confirmed) {
      return;
    }


    try {

      const res = await fetch(
        `${API}/notes/${encodeURIComponent(selected)}`,
        {
          method: "DELETE"
        }
      );


      if (!res.ok) {

        throw new Error(
          "Delete failed"
        );

      }


      /*
        Reset editor.
      */

      setSelected(null);

      setTitle("New Note");

      setContent("");

      setDirty(false);

      dirtyRef.current = false;

      setMessage(
        "Note deleted and versioned in Git"
      );


      /*
        Reload sidebar.
      */

      await loadNotes();

    } catch (e) {

      setMessage(`✕ ${e.message}`);

    }

  }


  /* =====================================================
     SHOW GIT HISTORY
     ===================================================== */

  async function showGitLog() {

    try {

      const res = await fetch(
        `${API}/git-log`
      );


      if (!res.ok) {

        throw new Error(
          "Could not load Git history"
        );

      }


      const data = await res.json();

      setGitLog(data);

      setShowLog(true);

    } catch (e) {

      setMessage(`✕ ${e.message}`);

    }

  }


  /* =====================================================
     FILTER NOTES
     ===================================================== */

  const filtered = useMemo(() => {

    const q = query
      .toLowerCase()
      .trim();


    /*
      If search box is empty,
      show all notes.
    */

    if (!q) {
      return notes;
    }


    /*
      Search both title and content.
    */

    return notes.filter((n) =>

      n.title
        .toLowerCase()
        .includes(q)

      ||

      n.content
        .toLowerCase()
        .includes(q)

    );

  }, [notes, query]);


  /* =====================================================
     RENDER
     ===================================================== */

  return (

    <div
      className={`app-shell ${
        darkMode ? "dark" : "light"
      }`}
    >


      {/* =================================================
          SIDEBAR
          ================================================= */}

      <aside className="sidebar">


        {/* BRAND */}

        <div className="brand">

          <div className="logo">
            G
          </div>

          <div>

            <strong>
              GitWiki
            </strong>

            <span>
              Local Knowledge Base
            </span>

          </div>

        </div>


        {/* NEW NOTE */}

        <button
          className="new-btn"
          onClick={newNote}
        >
          ＋ New Note
        </button>


        {/* SEARCH */}

        <input
          className="search"
          placeholder="Search notes..."
          value={query}
          onChange={(e) =>
            setQuery(e.target.value)
          }
        />


        {/* DOCUMENTS LABEL */}

        <div className="section-label">
          DOCUMENTS
        </div>


        {/* NOTES */}

        <div className="notes">

          {filtered.map((note) => (

            <button
              key={note.filename}
              className={`note-item ${
                selected === note.filename
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                openNote(note)
              }
            >

              <span>
                ▤
              </span>

              {note.title}

            </button>

          ))}


          {!filtered.length && (

            <div className="empty">
              No notes found
            </div>

          )}

        </div>


        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">


          {/* GIT HISTORY */}

          <button
            onClick={showGitLog}
          >
            ⟲ Git History
          </button>


          {/* GIT STATUS */}

          <div className="status">

            <i />

            Local Git repository active

          </div>

        </div>

      </aside>


      {/* =================================================
          MAIN AREA
          ================================================= */}

      <main className="main">


        {/* HEADER */}

        <header>


          {/* BREADCRUMB */}

          <div className="crumb">

            KNOWLEDGE BASE /

            {" "}

            {selected || "NEW NOTE"}

          </div>


          {/* ACTION BUTTONS */}

          <div className="actions">


            {/* THEME BUTTON */}

            <button
              className="theme-toggle"
              onClick={() =>
                setDarkMode(!darkMode)
              }
              title={
                darkMode
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-label={
                darkMode
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >

              {darkMode
                ? "☀️"
                : "🌙"}

            </button>


            {/* DELETE BUTTON */}

            <button
              className="delete-btn"
              onClick={deleteNote}
            >
              Delete
            </button>

          </div>

        </header>


        {/* =================================================
            EDITOR + PREVIEW
            ================================================= */}

        <div className="workspace">


          {/* EDITOR */}

          <section className="editor">


            {/* TITLE */}

            <input
              className="title"
              value={title}
              onChange={(e) => {

                setTitle(e.target.value);

                markChanged();

              }}
            />


            {/* MARKDOWN TEXT AREA */}

            <textarea
              value={content}
              onChange={(e) => {

                setContent(e.target.value);

                markChanged();

              }}
              spellCheck="false"
              placeholder="Start writing in Markdown..."
            />


            {/* SAVE STATUS */}

            <div
              className={`hint ${
                saving ? "saving" : ""
              }`}
            >

              {message}

            </div>

          </section>


          {/* LIVE PREVIEW */}

          <section className="preview">


            <div className="preview-label">
              LIVE PREVIEW
            </div>


            <article>

              <ReactMarkdown>
                {content}
              </ReactMarkdown>

            </article>

          </section>

        </div>

      </main>


      {/* =================================================
          GIT HISTORY MODAL
          ================================================= */}

      {showLog && (

        <div
          className="modal-backdrop"
          onClick={() =>
            setShowLog(false)
          }
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >


            {/* MODAL HEADER */}

            <div className="modal-head">

              <h2>
                Git History
              </h2>

              <button
                onClick={() =>
                  setShowLog(false)
                }
                aria-label="Close Git history"
              >
                ×
              </button>

            </div>


            {/* COMMITS */}

            {gitLog.length === 0 ? (

              <div className="empty">
                No Git commits found.
              </div>

            ) : (

              gitLog.map((item) => (

                <div
                  className="commit"
                  key={item.hash}
                >

                  <code>
                    {item.hash}
                  </code>

                  <div>

                    <strong>
                      {item.message}
                    </strong>

                    <span>
                      {item.date}
                    </span>

                  </div>

                </div>

              ))

            )}

          </div>

        </div>

      )}

    </div>

  );

}