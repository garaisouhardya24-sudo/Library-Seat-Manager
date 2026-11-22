/* Safety net: never let the sign-in forms reload the page. If the app script failed to load, say why. */
document.addEventListener(
  "submit",
  function (e) {
    e.preventDefault();
    if (!window.__havenReady) {
      var m = document.getElementById(
        e.target.id === "signupForm" ? "signupError" : "authError",
      );
      if (m)
        m.textContent =
          "The app script did not load. Make sure js/haven.js sits next to index.html in a js folder, then press Ctrl+F5.";
    }
  },
  true,
);
window.addEventListener("error", function (ev) {
  var m = document.getElementById("authError");
  if (m && !window.__havenReady) m.textContent = "Script error: " + ev.message;
});

(function () {
  "use strict";
  /* ===== store.js ===== */
  const { STORE_KEY, USERS_KEY, store, subscribe } = (() => {
    /* One localStorage boundary shared by both role dashboards. */
    const STORE_KEY = "haven.store.v3";
    const USERS_KEY = "haven.users.v3";
    const OLD_DATA_KEY = "haven.data.v2";
    const OLD_USERS_KEY = "haven.users.v2";
    const now = Date.now();

    const demoStudents = [
      [
        "STU-1042",
        "Riya Sharma",
        "Computer Science",
        "2nd year",
        "riya@college.edu",
      ],
      [
        "STU-1001",
        "Arjun Mehta",
        "Electronics",
        "3rd year",
        "arjun@college.edu",
      ],
      [
        "STU-1002",
        "Meera Kaur",
        "Computer Science",
        "2nd year",
        "meera@college.edu",
      ],
      [
        "STU-1003",
        "Kabir Singh",
        "Mechanical",
        "1st year",
        "kabir@college.edu",
      ],
      [
        "STU-1004",
        "Anaya Patel",
        "Computer Science",
        "4th year",
        "anaya@college.edu",
      ],
      ["STU-1005", "Dev Malhotra", "Civil", "3rd year", "dev@college.edu"],
      ["STU-1006", "Sana Ali", "Electronics", "2nd year", "sana@college.edu"],
      [
        "STU-1007",
        "Ishaan Verma",
        "Computer Science",
        "1st year",
        "ishaan@college.edu",
      ],
      [
        "STU-1008",
        "Tara Nair",
        "Biotechnology",
        "3rd year",
        "tara@college.edu",
      ],
      [
        "STU-1009",
        "Vivaan Rao",
        "Mechanical",
        "2nd year",
        "vivaan@college.edu",
      ],
      [
        "STU-1010",
        "Aditi Joshi",
        "Computer Science",
        "4th year",
        "aditi@college.edu",
      ],
      ["STU-1011", "Rehan Khan", "Electrical", "2nd year", "rehan@college.edu"],
    ];

    function freshStore() {
      const students = demoStudents.map(
        ([uid, name, department, year, email], index) => {
          const seated = index > 0 && index < 9;
          const floor = (index % 3) + 1;
          const seat = 3 + index * 3;
          const checkedInAt = now - (22 + index * 13) * 60_000;
          return {
            uid,
            name,
            department,
            year,
            email,
            notes: [],
            flags: [],
            sessions: seated
              ? [
                  {
                    floor,
                    seat,
                    checkedInAt,
                    endedAt: null,
                    onBreak: index === 3,
                    breakEndsAt: index === 3 ? now + 8 * 60_000 : null,
                    durationMs: 0,
                    autoReleased: false,
                  },
                ]
              : [],
          };
        },
      );
      return {
        students,
        blocked: ["1-40", "2-40", "3-40"],
        capacities: {
          library: {
            1: 40,
            2: 40,
            3: 40,
          },
          lab: {
            1: 20,
          },
        },
        history: [],
        activity: [
          {
            at: now,
            action: "Demo store initialized",
            detail: "Sample library and student records loaded",
            actor: "System",
          },
        ],
        releasesToday: 0,
      };
    }

    function readJSON(key) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    }

    function migrateLegacy() {
      const old = readJSON(OLD_DATA_KEY);
      if (!old || !old.floors) return null;
      const migrated = freshStore();
      migrated.blocked = [];
      for (const floor of [1, 2, 3]) {
        const data = old.floors[floor] || {};
        for (const seat of data.blocked || [])
          migrated.blocked.push(`${floor}-${String(seat).padStart(2, "0")}`);
      }
      if (old.session) {
        const student = migrated.students.find(
          (record) => record.email === "riya@college.edu",
        );
        student.sessions.push({
          floor: old.session.floor,
          seat: old.session.seat,
          checkedInAt: old.session.startedAt || Date.now(),
          endedAt: null,
          onBreak: Boolean(old.session.breakAt),
          breakEndsAt: old.session.breakAt
            ? old.session.breakAt + (old.session.breakDuration || 20) * 60_000
            : null,
          durationMs: 0,
          autoReleased: false,
        });
      }
      migrated.activity.unshift({
        at: Date.now(),
        action: "Legacy data migrated",
        detail: "Previous Haven v2 data loaded safely into v3",
        actor: "System",
      });
      return migrated;
    }

    let state = readJSON(STORE_KEY);
    if (
      !state ||
      !Array.isArray(state.students) ||
      !Array.isArray(state.blocked) ||
      !Array.isArray(state.activity)
    )
      state = migrateLegacy() || freshStore();
    state.capacities = state.capacities || {};
    state.capacities.library = state.capacities.library || {
      1: 40,
      2: 40,
      3: 40,
    };
    state.capacities.lab = state.capacities.lab || {
      1: 20,
    };
    for (const f of [1, 2, 3])
      state.capacities.library[f] = Math.max(
        1,
        Number(state.capacities.library[f]) || 40,
      );
    state.capacities.lab[1] = Math.max(
      1,
      Number(state.capacities.lab[1]) || 20,
    );
    let users = readJSON(USERS_KEY);
    const demoUsers = [
      {
        uid: "STU-1042",
        email: "riya@college.edu",
        name: "Riya Sharma",
        department: "Computer Science",
        year: "2nd year",
        role: "student",
        password: "Haven@123",
      },
      {
        uid: "LIB-001",
        email: "admin@college.edu",
        name: "Library Admin",
        department: "Library",
        year: "Staff",
        role: "admin",
        password: "Admin@123",
      },
    ];
    if (!Array.isArray(users) || !users.length) {
      const oldUsers = readJSON(OLD_USERS_KEY);
      users = [...demoUsers];
      if (Array.isArray(oldUsers))
        for (const user of oldUsers)
          if (!users.some((record) => record.email === user.email))
            users.push({
              ...user,
              uid: user.studentId || user.uid,
            });
    }
    // Keep the documented demo accounts usable even if an older test saved edited credentials.
    for (const demo of demoUsers) {
      const saved = users.find(
        (user) => user.email?.toLowerCase() === demo.email,
      );
      if (saved) Object.assign(saved, demo);
      else
        users.push({
          ...demo,
        });
    }

    function write() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      } catch (error) {
        console.warn("Haven could not persist this update.", error);
      }
    }
    write();

    const store = {
      get state() {
        return state;
      },
      get users() {
        return users;
      },
      getStudent(uid) {
        return state.students.find((student) => student.uid === uid) || null;
      },
      getSession(uid) {
        const student = this.getStudent(uid);
        return student?.sessions.find((session) => !session.endedAt) || null;
      },
      currentOccupant(floor, seat, facility = "library") {
        return (
          state.students.find((student) => {
            const x = this.getSession(student.uid);
            return (
              x?.floor === floor &&
              x?.seat === seat &&
              (x.facility || "library") === facility
            );
          }) || null
        );
      },
      capacity(facility = "library", floor = 1) {
        return Number(state.capacities[facility]?.[floor]) || 0;
      },
      resizeCapacity(facility, floor, next) {
        const current = this.capacity(facility, floor),
          target = Math.max(
            1,
            Math.min(200, Math.floor(Number(next) || current)),
          );
        if (target < current) {
          for (let n = current; n > target; n--)
            if (this.currentOccupant(floor, n, facility)) return false;
          state.blocked = state.blocked.filter((item) => {
            const m =
              facility === "lab"
                ? item.match(/^LAB-(\d+)-(\d+)$/)
                : item.match(/^(\d+)-(\d+)$/);
            return !(m && Number(m[1]) === floor && Number(m[2]) > target);
          });
        }
        state.capacities[facility][floor] = target;
        this.log(
          "Seat capacity updated",
          `${facility === "lab" ? "Computer lab" : "Library"} · ${facility === "lab" ? "Lab" : `Floor ${floor}`} · ${current} to ${target} seats`,
          "Library Admin",
        );
        write();
        return true;
      },
      isBlocked(floor, seat, facility = "library") {
        const k = `${floor}-${String(seat).padStart(2, "0")}`;
        return state.blocked.includes(facility === "lab" ? `LAB-${k}` : k);
      },
      addStudent(student) {
        state.students.push(student);
        users.push(student);
        write();
        this.log(
          "Student account created",
          `${student.uid} · ${student.name}`,
          student.name,
        );
      },
      checkIn(uid, floor, seat, facility = "library") {
        if (
          seat > this.capacity(facility, floor) ||
          this.isBlocked(floor, seat, facility) ||
          this.currentOccupant(floor, seat, facility)
        )
          return false;
        const student = this.getStudent(uid);
        if (!student || this.getSession(uid)) return false;
        student.sessions.push({
          floor,
          seat,
          facility,
          checkedInAt: Date.now(),
          endedAt: null,
          onBreak: false,
          breakEndsAt: null,
          durationMs: 0,
          autoReleased: false,
        });
        this.log(
          "Student checked in",
          `${uid} checked into ${facility === "lab" ? "Computer lab" : "Library"} ${floor}-${String(seat).padStart(2, "0")}`,
          student.name,
        );
        write();
        return true;
      },
      startBreak(uid, minutes = 20) {
        const session = this.getSession(uid);
        if (!session) return;
        session.onBreak = true;
        session.breakEndsAt = Date.now() + minutes * 60_000;
        this.log(
          "Break started",
          `${uid} · ${minutes} minutes`,
          this.getStudent(uid).name,
        );
        write();
      },
      returnFromBreak(uid) {
        const session = this.getSession(uid);
        if (!session) return;
        session.onBreak = false;
        session.breakEndsAt = null;
        this.log("Student returned from break", uid, this.getStudent(uid).name);
        write();
      },
      extendBreak(uid) {
        const session = this.getSession(uid);
        if (!session?.onBreak || session.extended) return;
        session.breakEndsAt += 5 * 60_000;
        session.extended = true;
        this.log("Break extended", uid, this.getStudent(uid).name);
        write();
      },
      endSession(uid, auto = false, reason = "Student ended session") {
        const student = this.getStudent(uid),
          session = this.getSession(uid);
        if (!student || !session) return;
        session.endedAt = Date.now();
        session.durationMs = session.endedAt - session.checkedInAt;
        session.autoReleased = auto;
        state.history.push({
          uid,
          name: student.name,
          facility: session.facility || "library",
          floor: session.floor,
          seat: session.seat,
          checkedInAt: session.checkedInAt,
          endedAt: session.endedAt,
          durationMs: session.durationMs,
          autoReleased: auto,
        });
        if (auto) state.releasesToday += 1;
        this.log(
          auto ? "Seat auto-released" : "Seat released",
          `${uid} · ${reason}`,
          "Library Admin",
        );
        write();
      },
      blockSeat(floor, seat, reason, facility = "library") {
        if (this.currentOccupant(floor, seat, facility)) return false;
        const k =
          facility === "lab"
            ? `LAB-${floor}-${String(seat).padStart(2, "0")}`
            : `${floor}-${String(seat).padStart(2, "0")}`;
        if (!state.blocked.includes(k)) state.blocked.push(k);
        this.log(
          "Seat blocked",
          `${facility === "lab" ? "Computer lab " : "Library "}${k} · ${reason}`,
          "Library Admin",
        );
        write();
        return true;
      },
      unblockSeat(floor, seat, reason, facility = "library") {
        const k =
          facility === "lab"
            ? `LAB-${floor}-${String(seat).padStart(2, "0")}`
            : `${floor}-${String(seat).padStart(2, "0")}`;
        state.blocked = state.blocked.filter((x) => x !== k);
        this.log(
          "Seat unblocked",
          `${facility === "lab" ? "Computer lab " : "Library "}${k} · ${reason}`,
          "Library Admin",
        );
        write();
      },
      editSeat(
        fromFacility,
        fromFloor,
        fromSeat,
        toFacility,
        toFloor,
        nextStatus,
        reason,
      ) {
        const occupant = this.currentOccupant(
            fromFloor,
            fromSeat,
            fromFacility,
          ),
          same = fromFacility === toFacility && fromFloor === toFloor;
        if (occupant && nextStatus === "blocked") return false;
        if (same) {
          const k =
            fromFacility === "lab"
              ? `LAB-${fromFloor}-${String(fromSeat).padStart(2, "0")}`
              : `${fromFloor}-${String(fromSeat).padStart(2, "0")}`;
          state.blocked = state.blocked.filter((item) => item !== k);
          if (nextStatus === "blocked") state.blocked.push(k);
          this.log(
            "Seat updated",
            `${fromFacility === "lab" ? "Computer lab" : "Library"} ${fromFloor}-${String(fromSeat).padStart(2, "0")} · ${reason}`,
            "Library Admin",
          );
          write();
          return {
            seat: fromSeat,
          };
        }
        const fromCount = this.capacity(fromFacility, fromFloor),
          toCount = this.capacity(toFacility, toFloor);
        if (fromCount <= 1 || toCount >= 200) return false;
        const toSeat = toCount + 1;
        state.blocked = state.blocked.flatMap((item) => {
          const m =
            fromFacility === "lab"
              ? item.match(/^LAB-(\d+)-(\d+)$/)
              : item.match(/^(\d+)-(\d+)$/);
          if (!m || Number(m[1]) !== fromFloor) return [item];
          const n = Number(m[2]);
          if (n === fromSeat) return [];
          if (n > fromSeat)
            return [
              fromFacility === "lab"
                ? `LAB-${fromFloor}-${String(n - 1).padStart(2, "0")}`
                : `${fromFloor}-${String(n - 1).padStart(2, "0")}`,
            ];
          return [item];
        });
        for (const student of state.students) {
          const session = this.getSession(student.uid);
          if (
            !session ||
            (session.facility || "library") !== fromFacility ||
            session.floor !== fromFloor
          )
            continue;
          if (session.seat === fromSeat) {
            session.facility = toFacility;
            session.floor = toFloor;
            session.seat = toSeat;
          } else if (session.seat > fromSeat) session.seat -= 1;
        }
        state.capacities[fromFacility][fromFloor] = fromCount - 1;
        state.capacities[toFacility][toFloor] = toCount + 1;
        if (nextStatus === "blocked")
          state.blocked.push(
            toFacility === "lab"
              ? `LAB-${toFloor}-${String(toSeat).padStart(2, "0")}`
              : `${toFloor}-${String(toSeat).padStart(2, "0")}`,
          );
        this.log(
          "Seat moved",
          `${fromFacility} ${fromFloor}-${String(fromSeat).padStart(2, "0")} → ${toFacility} ${toFloor}-${String(toSeat).padStart(2, "0")} · ${reason}`,
          "Library Admin",
        );
        write();
        return {
          seat: toSeat,
        };
      },
      log(action, detail, actor = "System") {
        state.activity.unshift({
          at: Date.now(),
          action,
          detail,
          actor,
        });
        state.activity = state.activity.slice(0, 500);
        write();
      },
      addNote(uid, text) {
        const student = this.getStudent(uid);
        if (student) {
          student.notes.push({
            text,
            at: Date.now(),
          });
          this.log("Student note added", `${uid} · ${text}`, "Library Admin");
          write();
        }
      },
      clearActivity() {
        state.activity = [];
        write();
      },
      refreshFromStorage() {
        const next = readJSON(STORE_KEY);
        if (next && Array.isArray(next.students)) state = next;
        const nextUsers = readJSON(USERS_KEY);
        if (Array.isArray(nextUsers)) users = nextUsers;
      },
    };

    function subscribe(callback) {
      window.addEventListener("storage", (event) => {
        if ([STORE_KEY, USERS_KEY].includes(event.key)) {
          store.refreshFromStorage();
          callback(event.key);
        }
      });
    }

    return {
      STORE_KEY,
      USERS_KEY,
      store,
      subscribe,
    };
  })();
  /* ===== shared-ui.js ===== */
  const {
    escapeHTML,
    formatTime,
    formatDate,
    duration,
    toast,
    openModal,
    closeModal,
    setTheme,
    toggleTheme,
    initializeTheme,
  } = (() => {
    function escapeHTML(value) {
      return String(value ?? "").replace(
        /[&<>\"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '\"': "&quot;",
            "'": "&#39;",
          })[char],
      );
    }
    const formatTime = (value) =>
      new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      }).format(value);
    const formatDate = (value = new Date()) =>
      new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(value);

    function duration(ms) {
      const minutes = Math.max(0, Math.floor(ms / 60000));
      return minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`;
    }
    let toastTimeout;

    function toast(message) {
      const node = document.getElementById("toast");
      node.textContent = message;
      node.classList.add("show");
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => node.classList.remove("show"), 2600);
    }

    function openModal({
      eyebrow = "",
      title,
      body = "",
      actions = "",
      onReady = null,
    }) {
      document.getElementById("modalEyebrow").textContent = eyebrow;
      document.getElementById("modalTitle").textContent = title;
      document.getElementById("modalBody").innerHTML = body;
      document.getElementById("modalActions").innerHTML = actions;
      document.getElementById("modalBackdrop").classList.add("open");
      onReady?.();
      document.getElementById("modalX").focus();
    }

    function closeModal() {
      document.getElementById("modalBackdrop").classList.remove("open");
    }
    const THEME_KEY = "haven.theme.v3";

    function setTheme(theme) {
      document.body.classList.toggle("dark", theme === "dark");
      localStorage.setItem(THEME_KEY, theme);
      const button = document.getElementById("themeButton");
      button.textContent = theme === "dark" ? "☀" : "◐";
      button.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      );
    }

    function toggleTheme() {
      setTheme(document.body.classList.contains("dark") ? "light" : "dark");
    }

    function initializeTheme() {
      setTheme("dark");
    }

    return {
      escapeHTML,
      formatTime,
      formatDate,
      duration,
      toast,
      openModal,
      closeModal,
      setTheme,
      toggleTheme,
      initializeTheme,
    };
  })();
  /* ===== auth.js ===== */
  const { auth } = (() => {
    const AUTH_KEY = "haven.auth.v3";
    let currentUser = null;
    const auth = {
      get current() {
        return currentUser;
      },
      signIn(identifier, password, remember = true) {
        const query = identifier.trim().toLowerCase();
        currentUser =
          store.users.find(
            (user) =>
              (user.email?.toLowerCase() === query ||
                user.uid?.toLowerCase() === query ||
                user.studentId?.toLowerCase() === query) &&
              user.password === password,
          ) || null;
        if (!currentUser) return false;
        sessionStorage.setItem(AUTH_KEY, currentUser.uid);
        if (remember) localStorage.setItem(AUTH_KEY, currentUser.uid);
        else localStorage.removeItem(AUTH_KEY);
        return true;
      },
      signUp(details) {
        if (
          store.users.some(
            (user) =>
              user.email.toLowerCase() === details.email.toLowerCase() ||
              user.uid.toLowerCase() === details.uid.toLowerCase(),
          )
        )
          return {
            error: "That email or UID is already registered.",
          };
        const student = {
          ...details,
          role: "student",
          sessions: [],
          notes: [],
          flags: [],
        };
        store.addStudent(student);
        currentUser = student;
        localStorage.setItem(AUTH_KEY, student.uid);
        return {
          user: student,
        };
      },
      restore() {
        const uid =
          sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
        currentUser = uid
          ? store.users.find((user) => user.uid === uid) || null
          : null;
        return currentUser;
      },
      logout() {
        currentUser = null;
        sessionStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(AUTH_KEY);
      },
    };

    return {
      auth,
    };
  })();
  /* ===== student.js ===== */
  const { studentNav, renderStudent, setStudentRefresh, studentTick } = (() => {
    const seatKey = (floor, seat) =>
      `${floor}-${String(seat).padStart(2, "0")}`;
    let floor = 1,
      facility = "library",
      filter = "all",
      onUpdate = () => {},
      goalHours = Number(localStorage.getItem("haven.goal.v3") || 4);
    const current = (user) => store.getSession(user.uid);
    const status = (f, n, area = facility) =>
      store.isBlocked(f, n, area)
        ? "blocked"
        : store.currentOccupant(f, n, area)
          ? store.getSession(store.currentOccupant(f, n, area).uid).onBreak
            ? "break"
            : "taken"
          : "free";

    function studentNav() {
      return [
        {
          id: "find",
          label: "Find a seat",
          icon: "⌕",
        },
        {
          id: "stats",
          label: "My study stats",
          icon: "◷",
        },
        {
          id: "help",
          label: "Help & tour",
          icon: "?",
        },
      ];
    }

    function renderStudent(user, page = "find") {
      const session = current(user);
      const active =
        page === "stats"
          ? "My study stats"
          : page === "help"
            ? "Help & tour"
            : "Find a seat";
      document.getElementById("currentPageLabel").textContent = active;
      document.getElementById("pageEyebrow").textContent =
        page === "find" ? "YOUR QUIET CORNER AWAITS" : "YOUR HAVEN ACCOUNT";
      document.getElementById("pageTitle").textContent =
        page === "find"
          ? "Find your seat."
          : page === "stats"
            ? "Your study rhythm."
            : "A little help.";
      document.getElementById("pageSubtitle").textContent =
        page === "find"
          ? "A little less searching, a lot more studying."
          : page === "stats"
            ? "Your personal study time and recent sessions."
            : "Quick tips to help you settle in.";
      if (page === "stats") {
        renderStats(user);
        return;
      }
      if (page === "help") {
        renderHelp();
        return;
      }

      const filters =
        facility === "lab"
          ? ["all", "quiet", "window", "accessible"]
          : ["all", "quiet", "power", "window", "accessible"];
      const floors = facility === "library" ? [1, 2, 3] : [1];
      const seatCount = store.capacity(facility, floor);
      const availableSeats = floors.reduce(
        (sum, f) =>
          sum +
          Array.from(
            {
              length: store.capacity(facility, f),
            },
            (_, i) => i + 1,
          ).filter((n) => status(f, n, facility) === "free").length,
        0,
      );
      document.getElementById("pageContent").innerHTML = `
    <section class="metric-grid student-metrics"><article class="metric-card"><span class="metric-label">Seats available <b>⌂</b></span><strong class="metric-value">${availableSeats}</strong><span class="metric-note">${facility === "lab" ? "In the computer lab" : "Across three floors"}</span></article><article class="metric-card"><span class="metric-label">Your study time <b>◷</b></span><strong class="metric-value">${todayDuration(user)}</strong><span class="metric-note">Today · Keep it up</span></article><article class="metric-card"><span class="metric-label">Study goal <b>✦</b></span><strong class="metric-value">${goalHours} hours</strong><span class="metric-note">Daily focus goal</span></article><article class="metric-card"><span class="metric-label">Your session <b>◉</b></span><strong class="metric-value">${session ? "Active" : "Not checked in"}</strong><span class="metric-note">${session ? `${session.facility === "lab" ? "Computer lab · " : "Seat "}${seatKey(session.floor, session.seat)}` : "Choose a free seat to begin"}</span></article></section>
    <section class="student-layout"><article class="panel"><div class="panel-head"><div><h2>${facility === "lab" ? "Computer lab seats" : "Library floor plan"}</h2><p class="caption">Choose a green seat to check in</p></div><div class="floor-tabs"><button class="${facility === "library" ? "selected" : ""}" data-facility="library">Library</button><button class="${facility === "lab" ? "selected" : ""}" data-facility="lab">Computer lab</button></div></div><div class="floor-tabs area-floor-tabs">${facility === "library" ? floors.map((f) => `<button class="${f === floor ? "selected" : ""}" data-floor="${f}">Floor ${f}</button>`).join("") : `<button class="selected">Computer lab</button>`}</div>
      <div class="filter-row">${filters.map((x) => `<button class="filter-chip ${filter === x ? "selected" : ""}" data-filter="${x}">${x === "all" ? "All seats" : x[0].toUpperCase() + x.slice(1)}</button>`).join("")}<button class="outline" id="findSeat">Find me a seat</button></div>
      <div class="legend"><span><i class="seat-free"></i>Available</span><span><i class="seat-taken"></i>Occupied</span><span><i class="seat-break"></i>On break</span><span><i class="seat-blocked"></i>Unavailable</span></div>
      <div class="floor-map"><span class="window-label">WINDOWS</span><div class="seat-grid">${Array.from(
        { length: seatCount },
        (_, i) => i + 1,
      )
        .map((n) => seatButton(floor, n, facility))
        .join(
          "",
        )}</div></div><div class="panel-foot"><span>${facility === "lab" ? "Computer lab" : `Floor ${floor}`} · ${Array.from({ length: seatCount }, (_, i) => i + 1).filter((n) => status(floor, n, facility) === "free").length} available</span><button class="text-button" id="refreshMap">↻ Refresh</button></div></article>
      <aside class="student-side"><article class="panel"><div class="panel-head"><div><h2>Your study session</h2><p class="caption">${session ? "You’re all set for a focused session." : "Ready when you are."}</p></div><span id="sessionRing" class="session-ring">${session?.onBreak ? "◷" : "✦"}</span></div>${renderSession(user, session)}</article><article class="panel"><h2>Quick look</h2><p class="caption">Availability by floor</p><div class="quick-list">${(facility === "library" ? [1, 2, 3] : [1]).map((f) => `<div class="quick-row"><span>${facility === "lab" ? "Computer lab" : `Floor ${f}`}</span><b>${Array.from({ length: store.capacity(facility, f) }, (_, i) => i + 1).filter((n) => status(f, n, facility) === "free").length} free</b></div>`).join("")}</div><div class="tip" id="favoriteTip">${favoriteTip(user)}</div></article></aside></section>
    <section class="panel study-goal"><div><p class="eyebrow">YOUR DAILY GOAL</p><h2>${todayDuration(user)} of ${goalHours} hours</h2><p class="caption">Small focused sessions add up.</p></div><button class="outline" id="editGoal">Edit goal</button></section>`;
      document.querySelectorAll("[data-floor]").forEach(
        (button) =>
          (button.onclick = () => {
            floor = Number(button.dataset.floor);
            renderStudent(user, "find");
          }),
      );
      document.querySelectorAll("[data-facility]").forEach(
        (button) =>
          (button.onclick = () => {
            facility = button.dataset.facility;
            floor = 1;
            filter = "all";
            renderStudent(user, "find");
          }),
      );
      document.querySelectorAll("[data-filter]").forEach(
        (button) =>
          (button.onclick = () => {
            filter = button.dataset.filter;
            renderStudent(user, "find");
          }),
      );
      document
        .querySelectorAll("[data-seat]")
        .forEach(
          (button) =>
            (button.onclick = () =>
              checkIn(
                user,
                Number(button.dataset.floor),
                Number(button.dataset.seat),
                facility,
              )),
        );
      document.getElementById("refreshMap").onclick = () => {
        renderStudent(user, "find");
        toast("Seat availability refreshed.");
      };
      document.getElementById("findSeat").onclick = () => {
        const found = Array.from(
          {
            length: store.capacity(facility, floor),
          },
          (_, i) => i + 1,
        ).find((n) => status(floor, n, facility) === "free");
        if (found) checkIn(user, floor, found, facility);
        else toast("No available seats on this floor.");
      };
      document.getElementById("editGoal").onclick = () =>
        openModal({
          eyebrow: "STUDY GOAL",
          title: "Set your daily goal",
          body: `<label class="form-field">Hours per day<input id="goalInput" type="number" min="1" max="12" value="${goalHours}"></label>`,
          actions:
            '<button class="secondary" id="goalCancel">Cancel</button><button class="primary" id="goalSave">Save goal</button>',
          onReady: () => {
            document.getElementById("goalCancel").onclick = closeModal;
            document.getElementById("goalSave").onclick = () => {
              goalHours = Math.max(
                1,
                Math.min(
                  12,
                  Number(document.getElementById("goalInput").value) || 4,
                ),
              );
              localStorage.setItem("haven.goal.v3", goalHours);
              closeModal();
              renderStudent(user);
              toast("Study goal updated.");
            };
          },
        });
      document.getElementById("breakBtn")?.addEventListener("click", () => {
        store.startBreak(user.uid);
        renderStudent(user);
        onUpdate();
      });
      document.getElementById("returnBtn")?.addEventListener("click", () => {
        store.returnFromBreak(user.uid);
        renderStudent(user);
        onUpdate();
      });
      document.getElementById("extendBtn")?.addEventListener("click", () => {
        store.extendBreak(user.uid);
        renderStudent(user);
        onUpdate();
      });
      document.getElementById("endBtn")?.addEventListener("click", () =>
        openModal({
          eyebrow: "STUDY SESSION",
          title: "End your session?",
          body: "Your seat will become available to another student.",
          actions:
            '<button class="secondary" id="keepSession">Keep studying</button><button class="primary" id="confirmEnd">End session</button>',
          onReady: () => {
            document.getElementById("keepSession").onclick = closeModal;
            document.getElementById("confirmEnd").onclick = () => {
              store.endSession(user.uid, false, "Student ended session");
              closeModal();
              renderStudent(user);
              onUpdate();
              toast("Session ended. Nice work!");
            };
          },
        }),
      );
    }

    function seatButton(f, n, area = facility) {
      const state = status(f, n, area),
        occupied = store.currentOccupant(f, n, area),
        features = {
          quiet: n <= 16 || n > 32,
          power: n % 3 === 0,
          window: n % 8 === 1 || n % 8 === 0,
          accessible: n % 10 === 0,
        };
      const matches = filter === "all" || features[filter];
      const disabled = state !== "free" || !matches;
      return `<button class="seat ${state} ${matches ? "" : "filtered"}" data-seat="${n}" data-floor="${f}" ${disabled ? "disabled" : ""} aria-label="${area === "lab" ? "Computer lab" : "Library"} seat ${seatKey(f, n, area)}, ${state}">${String(n).padStart(2, "0")}${occupied ? "" : ""}</button>`;
    }

    function renderSession(user, session) {
      if (!session)
        return '<div class="empty-state">⌂<p>No seat checked in yet.<br>Pick a green seat to begin.</p></div>';
      const elapsed = Date.now() - session.checkedInAt;
      const remaining = session.breakEndsAt
        ? Math.max(0, session.breakEndsAt - Date.now())
        : 0;
      return `<div class="session-card"><span class="status-pill ${session.onBreak ? "break" : ""}">${session.onBreak ? "ON BREAK" : "CHECKED IN"}</span><h3>${session.facility === "lab" ? "Computer lab · " : "Seat "}${seatKey(session.floor, session.seat, session.facility || "library")}</h3><p class="caption">${session.onBreak ? "Your seat is held while you step away." : session.facility === "lab" ? "Computer lab · Session in progress" : "Quiet study area · Session in progress"}</p><div class="session-stat"><span>${session.onBreak ? "Break ends in" : "Time seated"}</span><b id="sessionDuration">${session.onBreak ? duration(remaining) : duration(elapsed)}</b></div><div class="student-actions">${session.onBreak ? `<button class="primary" id="returnBtn">I’m back</button><button class="secondary" id="extendBtn" ${session.extended ? "disabled" : ""}>Extend once</button>` : '<button class="primary" id="breakBtn">Take a break</button>'}<button class="secondary" id="endBtn">End session</button></div></div>`;
    }

    function checkIn(user, f, n, area = facility) {
      if (current(user)) {
        toast("End your current session before choosing another seat.");
        return;
      }
      openModal({
        eyebrow: `${area === "lab" ? "COMPUTER LAB" : "LIBRARY"} · SEAT ${seatKey(f, n, area)}`,
        title: `Check in to ${area === "lab" ? "computer lab " : "library "}${seatKey(f, n, area)}?`,
        body: "Choose to begin your study session or save this seat as a favourite.",
        actions:
          '<button class="secondary" id="seatCancel">Cancel</button><button class="outline" id="favoriteSeat">☆ Save favourite</button><button class="primary" id="seatCheckIn">Check in</button>',
        onReady: () => {
          document.getElementById("seatCancel").onclick = closeModal;
          document.getElementById("favoriteSeat").onclick = () => {
            const favKey = `haven.favorites.v3.${user.uid}`;
            const list = JSON.parse(localStorage.getItem(favKey) || "[]");
            if (
              !list.some(
                (item) =>
                  item.floor === f &&
                  item.seat === n &&
                  (item.facility || "library") === area,
              )
            )
              list.push({
                floor: f,
                seat: n,
                facility: area,
              });
            localStorage.setItem(favKey, JSON.stringify(list));
            closeModal();
            renderStudent(user);
            toast(`Saved ${seatKey(f, n)} as a favourite.`);
          };
          document.getElementById("seatCheckIn").onclick = () => {
            if (!store.checkIn(user.uid, f, n, area)) {
              closeModal();
              toast("That seat is no longer available.");
              return;
            }
            floor = f;
            facility = area;
            closeModal();
            renderStudent(user);
            onUpdate();
            toast(
              `Checked in to ${area === "lab" ? "computer lab " : "library "}${seatKey(f, n, area)}.`,
            );
          };
        },
      });
    }

    function todayDuration(user) {
      const today = new Date().toDateString();
      const past = store.state.history
        .filter(
          (x) =>
            x.uid === user.uid &&
            new Date(x.checkedInAt).toDateString() === today,
        )
        .reduce((sum, x) => sum + (x.durationMs || 0), 0);
      const session = current(user);
      return duration(past + (session ? Date.now() - session.checkedInAt : 0));
    }

    function favoriteTip(user) {
      const saved = JSON.parse(
        localStorage.getItem(`haven.favorites.v3.${user.uid}`) || "[]",
      );
      return saved.length
        ? `☆ Your saved seats: ${saved.map((x) => escapeHTML(`${x.facility === "lab" ? "Computer lab · " : ""}${seatKey(x.floor, x.seat)}`)).join(", ")}`
        : "☆ Tap a seat to check in. Save favorite seats from the map later.";
    }

    function renderStats(user) {
      const records = store.state.history.filter((x) => x.uid === user.uid);
      document.getElementById("pageContent").innerHTML =
        `<section class="metric-grid"><article class="metric-card"><span class="metric-label">Today</span><strong class="metric-value">${todayDuration(user)}</strong></article><article class="metric-card"><span class="metric-label">Completed sessions</span><strong class="metric-value">${records.length}</strong></article><article class="metric-card"><span class="metric-label">Daily goal</span><strong class="metric-value">${goalHours} hours</strong></article><article class="metric-card"><span class="metric-label">Favourite seats</span><strong class="metric-value">${JSON.parse(localStorage.getItem(`haven.favorites.v3.${user.uid}`) || "[]").length}</strong></article></section><article class="panel"><h2>My study stats</h2><p class="caption">Recent sessions saved on this Haven account.</p><div class="table-scroll"><table><thead><tr><th>DATE</th><th>SEAT</th><th>DURATION</th><th>ENDED</th></tr></thead><tbody>${
          records
            .slice(-20)
            .reverse()
            .map(
              (x) =>
                `<tr><td>${escapeHTML(new Date(x.checkedInAt).toLocaleDateString("en-IN"))}</td><td>${escapeHTML(`${x.facility === "lab" ? "Computer lab · " : ""}${seatKey(x.floor, x.seat)}`)}</td><td>${duration(x.durationMs)}</td><td>${formatTime(x.endedAt)}</td></tr>`,
            )
            .join("") ||
          '<tr><td colspan="4" class="empty-state">No completed sessions yet.</td></tr>'
        }</tbody></table></div></article>`;
    }

    function renderHelp() {
      document.getElementById("pageContent").innerHTML =
        '<article class="panel help-panel"><h2>Welcome to Haven</h2><p>Choose a floor, pick a green seat and check in. Your session appears in your personal study stats.</p><h3>Taking a break</h3><p>Start a break when you step away. Return before the timer ends to keep your seat, or extend it once.</p><h3>Need a quick tour?</h3><button class="primary" id="startTour">Start the Haven tour</button></article>';
      document.getElementById("startTour").onclick = () =>
        openModal({
          eyebrow: "HAVEN QUICK TOUR",
          title: "Find a seat, then focus",
          body: "Use the floor tabs and seat filters to find a spot that works for you. Check in to begin your study session. Your break timer helps keep seats available for everyone.",
          actions: '<button class="primary" id="tourDone">Got it</button>',
          onReady: () =>
            (document.getElementById("tourDone").onclick = closeModal),
        });
    }

    function setStudentRefresh(callback) {
      onUpdate = callback;
    }

    function studentTick(user) {
      const session = current(user);
      if (session?.onBreak && session.breakEndsAt <= Date.now()) {
        store.endSession(user.uid, true, "Break timer expired");
        onUpdate();
        toast("Your break ended and the seat was released.");
      } else if (document.getElementById("sessionDuration")) {
        document.getElementById("sessionDuration").textContent = session.onBreak
          ? duration(session.breakEndsAt - Date.now())
          : duration(Date.now() - session.checkedInAt);
      }
    }

    return {
      studentNav,
      renderStudent,
      setStudentRefresh,
      studentTick,
    };
  })();
  /* ===== admin.js ===== */
  const { adminNav, showAdminGuide, renderAdmin, setAdminRefresh, adminTick } =
    (() => {
      let floor = 1,
        facility = "library",
        page = "overview",
        currentAdmin = null,
        search = "",
        redraw = () => {};
      const key = (f, n) => `${f}-${String(n).padStart(2, "0")}`;
      const sessions = () =>
        store.state.students.flatMap((student) => {
          const session = store.getSession(student.uid);
          return session
            ? [
                {
                  student,
                  session,
                },
              ]
            : [];
        });

      function adminNav() {
        return [
          {
            id: "overview",
            label: "Overview",
            icon: "▦",
          },
          {
            id: "students",
            label: "Student lookup",
            icon: "♙",
          },
          {
            id: "activity",
            label: "Activity log",
            icon: "◷",
          },
          {
            id: "reports",
            label: "Reports",
            icon: "▤",
          },
        ];
      }

      function showAdminGuide() {
        openModal({
          eyebrow: "LIBRARY MONITOR",
          title: "Admin guide",
          body: "Use Overview to monitor floor availability and release or block seats. Student lookup searches by UID, name or seat. Activity log records changes. Reports downloads a CSV snapshot.",
          actions: '<button class="primary" id="guideOk">Got it</button>',
          onReady: () =>
            (document.getElementById("guideOk").onclick = closeModal),
        });
      }

      function renderAdmin(user, selected = "overview") {
        if (user?.role !== "admin") return;
        currentAdmin = user;
        page = selected;
        const heading = {
          overview: [
            "LIBRARY MONITOR",
            "Monitor your library.",
            "Seat availability and active sessions across all floors.",
          ],
          students: [
            "STUDENT LOOKUP",
            "Find a student.",
            "Search by UID, name or current seat.",
          ],
          activity: [
            "LIBRARY MONITOR",
            "Recent activity.",
            "A timestamped record of library and admin actions.",
          ],
          reports: [
            "LIBRARY MONITOR",
            "Library reports.",
            "Occupancy and session data from the shared Haven store.",
          ],
        }[page];
        document.getElementById("currentPageLabel").textContent = heading[1];
        document.getElementById("pageEyebrow").textContent = heading[0];
        document.getElementById("pageTitle").textContent = heading[1];
        document.getElementById("pageSubtitle").textContent = heading[2];
        if (page === "overview") renderOverview();
        if (page === "students") renderStudents();
        if (page === "activity") renderActivity();
        if (page === "reports") renderReports();
      }

      function renderOverview() {
        const active = sessions(),
          occupied = active.filter((x) => !x.session.onBreak).length,
          onBreak = active.filter((x) => x.session.onBreak).length,
          blocked = store.state.blocked.length,
          total = Object.values(store.state.capacities)
            .flatMap((x) => Object.values(x))
            .reduce((a, b) => a + b, 0),
          available = total - occupied - onBreak - blocked;
        const countAlerts = onBreak + blocked;
        document.getElementById("notificationCount").textContent = countAlerts;
        document
          .getElementById("notificationCount")
          .classList.toggle("hidden", countAlerts === 0);
        const floorAvailability = (facility === "library" ? [1, 2, 3] : [1])
          .map((f) => {
            const cap = store.capacity(facility, f);
            const free = Array.from(
              {
                length: cap,
              },
              (_, i) => i + 1,
            ).filter((n) => seatStatus(f, n, facility) === "free").length;
            const pct = Math.round(((cap - free) / cap) * 100);
            const label = facility === "lab" ? "Computer lab" : "Floor " + f;
            return `<div class="quick-row"><span>${label} · ${pct}% used</span><b>${free} free</b></div><div class="progress"><i style="width:${pct}%"></i></div>`;
          })
          .join("");
        const breakAlerts = onBreak
          ? active
              .filter((x) => x.session.onBreak)
              .map((x) => {
                const areaLabel =
                  x.session.facility === "lab" ? "Computer lab · " : "";
                const location =
                  areaLabel +
                  key(
                    x.session.floor,
                    x.session.seat,
                    x.session.facility || "library",
                  );
                return `<p class="attention-item">◷ ${escapeHTML(x.student.name)} · ${escapeHTML(location)} · break</p>`;
              })
              .join("")
          : '<p class="empty-state">No overdue breaks. Everything looks good.</p>';
        const adminFloorTabs =
          facility === "library"
            ? [1, 2, 3]
                .map(
                  (f) =>
                    `<button data-admin-floor="${f}" class="${f === floor ? "selected" : ""}">Floor ${f}</button>`,
                )
                .join("")
            : '<button class="selected">Computer lab</button>';
        const seatButtons = Array.from(
          {
            length: store.capacity(facility, floor),
          },
          (_, i) => i + 1,
        )
          .map((n) => adminSeat(floor, n, facility))
          .join("");
        document.getElementById("pageContent").innerHTML =
          `<section class="metric-grid"><article class="metric-card"><span class="metric-label">Seats available <b>⌂</b></span><strong class="metric-value">${available}</strong><span class="metric-note">Library and computer lab</span></article><article class="metric-card"><span class="metric-label">Currently occupied <b>◉</b></span><strong class="metric-value">${occupied}</strong><span class="metric-note">Active study sessions</span></article><article class="metric-card"><span class="metric-label">On break <b>◷</b></span><strong class="metric-value">${onBreak}</strong><span class="metric-note">Break time remaining</span></article><article class="metric-card"><span class="metric-label">Blocked seats <b>⊘</b></span><strong class="metric-value">${blocked}</strong><span class="metric-note">Maintenance or staff hold</span></article></section>
            <section class="admin-layout"><article class="panel"><div class="panel-head"><div><h2>${facility === "lab" ? "Computer lab seats" : "Live seat map"}</h2><p class="caption">Select a seat to view or manage it.</p></div><div class="capacity-controls"><button class="secondary" id="removeSeatCount" aria-label="Remove one seat">−</button><b>${store.capacity(facility, floor)} seats</b><button class="secondary" id="addSeatCount" aria-label="Add one seat">+</button></div></div><div class="floor-tabs"><button data-admin-facility="library" class="${facility === "library" ? "selected" : ""}">Library</button><button data-admin-facility="lab" class="${facility === "lab" ? "selected" : ""}">Computer lab</button></div><div class="floor-tabs area-floor-tabs">${adminFloorTabs}</div><div class="legend"><span><i class="seat-free"></i>Available</span><span><i class="seat-taken"></i>Occupied</span><span><i class="seat-break"></i>On break</span><span><i class="seat-blocked"></i>Blocked</span></div><div class="floor-map"><span class="window-label">WINDOWS</span><div class="seat-grid">${seatButtons}</div></div><div class="panel-foot"><span>${facility === "lab" ? "Computer lab" : "Floor " + floor} · ${Array.from({ length: store.capacity(facility, floor) }, (_, i) => i + 1).filter((n) => seatStatus(floor, n, facility) === "free").length} available</span><button class="text-button" id="adminRefresh">↻ Refresh</button></div></article><aside class="admin-side"><article class="panel"><h2>Availability by floor</h2><p class="caption">Current usage breakdown</p><div class="quick-list">${floorAvailability}</div></article><article class="panel"><div class="panel-head"><div><h2>Needs attention</h2><p class="caption">Breaks and maintenance</p></div><span class="alert-badge">${countAlerts}</span></div>${breakAlerts}</article></aside></section>
            <article class="panel admin-live"><div class="panel-head"><div><h2>Live monitoring console</h2><p class="caption">Current student sessions · shared with student check-ins</p></div><span class="live-status"><i></i>LIVE</span></div>${sessionTable(active, "overview")}</article>`;
        document.querySelectorAll("[data-admin-floor]").forEach(
          (button) =>
            (button.onclick = () => {
              floor = Number(button.dataset.adminFloor);
              renderAdmin(currentAdmin, "overview");
            }),
        );
        document.querySelectorAll("[data-admin-facility]").forEach(
          (button) =>
            (button.onclick = () => {
              facility = button.dataset.adminFacility;
              floor = 1;
              renderAdmin(currentAdmin, "overview");
            }),
        );
        document.getElementById("addSeatCount").onclick = () => {
          const current = store.capacity(facility, floor);
          if (current >= 200)
            return toast("This area has reached the 200-seat limit.");
          if (!store.resizeCapacity(facility, floor, current + 1))
            return toast("Could not add a seat.");
          renderAdmin(currentAdmin, "overview");
          toast("One seat added.");
        };
        document.getElementById("removeSeatCount").onclick = () => {
          if (store.capacity(facility, floor) <= 1)
            return toast("At least one seat must remain.");
          if (
            !store.resizeCapacity(
              facility,
              floor,
              store.capacity(facility, floor) - 1,
            )
          )
            return toast(
              "The last seat is occupied. Release it before removing seats.",
            );
          renderAdmin(currentAdmin, "overview");
          toast("One seat removed.");
        };
        document
          .querySelectorAll("[data-seat-control]")
          .forEach(
            (button) =>
              (button.onclick = () =>
                seatDialog(
                  floor,
                  Number(button.dataset.seatControl),
                  facility,
                )),
          );
        document
          .querySelectorAll("[data-detail]")
          .forEach(
            (button) =>
              (button.onclick = () => studentDetail(button.dataset.detail)),
          );
        document.getElementById("adminRefresh").onclick = () => {
          renderAdmin(currentAdmin, "overview");
          toast("Monitor refreshed from shared store.");
        };
      }

      function seatStatus(f, n, area = facility) {
        if (store.isBlocked(f, n, area)) return "blocked";
        const student = store.currentOccupant(f, n, area);
        if (!student) return "free";
        return store.getSession(student.uid).onBreak ? "break" : "taken";
      }

      function adminSeat(f, n, area = facility) {
        const status = seatStatus(f, n, area),
          student = store.currentOccupant(f, n, area);
        return `<button class="seat ${status}" data-seat-control="${n}" aria-label="Seat ${key(f, n, area)}: ${status}" title="${key(f, n, area)} · ${status}${student ? ` · ${escapeHTML(student.uid)}` : ""}">${String(n).padStart(2, "0")}</button>`;
      }

      function sessionTable(rows, source = "students") {
        const controlHeader = source === "students" ? "<th>CONTROL</th>" : "";
        const body =
          rows
            .map(({ student, session }) => {
              const location =
                (session.facility === "lab" ? "Computer lab · " : "") +
                key(session.floor, session.seat, session.facility || "library");
              const control =
                source === "students"
                  ? `<td><button class="text-button danger-text" data-release-uid="${escapeHTML(student.uid)}">Release</button></td>`
                  : "";
              return `<tr><td><strong>${escapeHTML(student.name)}</strong><br><small>${escapeHTML(student.uid)} · ${escapeHTML(student.department || "")}</small></td><td>${escapeHTML(location)}</td><td>${formatTime(session.checkedInAt)}</td><td><span data-elapsed-uid="${escapeHTML(student.uid)}">${duration(Date.now() - session.checkedInAt)}</span></td><td><span class="status-pill ${session.onBreak ? "break" : ""}">${session.onBreak ? "On break" : "Seated"}</span></td><td><button class="text-button" data-detail="${escapeHTML(student.uid)}">Preview details</button></td>${control}</tr>`;
            })
            .join("") ||
          '<tr><td colspan="7" class="empty-state">No active student sessions.</td></tr>';
        return `<div class="table-scroll"><table><thead><tr><th>STUDENT / UID</th><th>LOCATION</th><th>CHECKED IN</th><th>TIME SEATED</th><th>STATUS</th><th>QUICK VIEW</th>${controlHeader}</tr></thead><tbody>${body}</tbody></table></div>`;
      }

      function renderStudents() {
        const rows = sessions();
        const all = store.state.students.filter((student) => {
          const session = store.getSession(student.uid);
          const haystack = [
            student.uid,
            student.name,
            student.department,
            session ? key(session.floor, session.seat) : "away",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(search.toLowerCase());
        });
        document.getElementById("pageContent").innerHTML =
          `<article class="panel"><div class="panel-head"><div><h2>Student lookup</h2><p class="caption">Search by UID, student name, department or seat.</p></div><label class="search-field">⌕ <input id="lookupSearch" aria-label="Search students" placeholder="Search UID, name, or seat" value="${escapeHTML(search)}"></label></div><p class="caption results-count">Showing ${all.length} of ${store.state.students.length} students · ${rows.length} active</p><div class="table-scroll"><table><thead><tr><th>UID</th><th>STUDENT</th><th>DEPARTMENT</th><th>CURRENT SEAT</th><th>STATUS</th><th>DETAILS</th><th>CONTROL</th></tr></thead><tbody>${
            all
              .map((student) => {
                const session = store.getSession(student.uid);
                return `<tr><td>${escapeHTML(student.uid)}</td><td><strong>${escapeHTML(student.name)}</strong></td><td>${escapeHTML(student.department || "—")}</td><td>${session ? escapeHTML(`${session.facility === "lab" ? "Computer lab · " : ""}${key(session.floor, session.seat, session.facility || "library")}`) : "Not in library"}</td><td><span class="status-pill ${session ? (session.onBreak ? "break" : "") : "away"}">${session ? (session.onBreak ? "On break" : "Seated") : "Away"}</span></td><td><button class="text-button" data-detail="${escapeHTML(student.uid)}">Fetch details</button></td><td>${session ? `<button class="text-button danger-text" data-release-uid="${escapeHTML(student.uid)}">Release</button>` : "—"}</td></tr>`;
              })
              .join("") ||
            '<tr><td colspan="7" class="empty-state">No student matches your search.</td></tr>'
          }</tbody></table></div></article>`;
        document.getElementById("lookupSearch").oninput = (e) => {
          search = e.target.value;
          renderStudents();
        };
        document
          .querySelectorAll("[data-detail]")
          .forEach((b) => (b.onclick = () => studentDetail(b.dataset.detail)));
        document.querySelectorAll("[data-release-uid]").forEach(
          (b) =>
            (b.onclick = () =>
              requestReason("Release this student’s seat?", (reason) => {
                store.endSession(b.dataset.releaseUid, false, reason);
                renderAdmin(currentAdmin, "students");
              })),
        );
      }

      function studentDetail(uid) {
        const student = store.getStudent(uid);
        if (!student) return;
        const session = store.getSession(uid),
          history = [
            ...store.state.history.filter((x) => x.uid === uid),
            ...student.sessions
              .filter((x) => x.endedAt)
              .map((x) => ({
                ...x,
                name: student.name,
                uid,
              })),
          ].sort((a, b) => b.checkedInAt - a.checkedInAt);
        openModal({
          eyebrow: "STUDENT RECORD",
          title: student.name,
          body: `<p class="caption">${escapeHTML(uid)} · ${escapeHTML(student.department || "—")} · ${escapeHTML(student.year || "")}</p><div class="student-facts"><div><small>STATUS</small><b>${session ? (session.onBreak ? "On break" : "Seated") : "Away"}</b></div><div><small>SEAT</small><b>${session ? escapeHTML(`${session.facility === "lab" ? "Computer lab · " : ""}${key(session.floor, session.seat, session.facility || "library")}`) : "Not in library"}</b></div><div><small>CHECKED IN</small><b>${session ? formatTime(session.checkedInAt) : "—"}</b></div><div><small>TIME SEATED</small><b>${session ? duration(Date.now() - session.checkedInAt) : "—"}</b></div></div><h3>Session history</h3><div class="history-list">${history.map((x) => `<p>${escapeHTML(`${x.facility === "lab" ? "Computer lab · " : ""}${key(x.floor, x.seat, x.facility || "library")}`)} · ${new Date(x.checkedInAt).toLocaleDateString("en-IN")} · ${duration(x.durationMs || (x.endedAt || Date.now()) - x.checkedInAt)}</p>`).join("") || '<p class="caption">No completed sessions recorded.</p>'}</div><label class="form-field">Admin note<textarea id="adminNote" rows="2" placeholder="Private note for library staff"></textarea></label><div id="studentNotes">${(student.notes || []).map((note) => `<p class="caption">${escapeHTML(note.text)} · ${formatDate(note.at)}</p>`).join("")}</div>`,
          actions: `<button class="secondary" id="detailClose">Close</button>${session ? '<button class="primary" id="detailRelease">Release seat</button>' : ""}<button class="outline" id="saveAdminNote">Save note</button>`,
          onReady: () => {
            document.getElementById("detailClose").onclick = closeModal;
            document.getElementById("saveAdminNote").onclick = () => {
              if (currentAdmin?.role !== "admin")
                return toast("Admin access required.");
              const note = document.getElementById("adminNote").value.trim();
              if (!note) return toast("Write a note first.");
              store.addNote(uid, note);
              closeModal();
              renderAdmin(currentAdmin, "students");
              toast("Private note saved.");
            };
            if (session)
              document.getElementById("detailRelease").onclick = () =>
                requestReason("Release this student's seat?", (reason) => {
                  store.endSession(uid, false, reason);
                  closeModal();
                  redraw();
                  toast("Student seat released.");
                });
          },
        });
      }

      function requestReason(title, callback) {
        openModal({
          eyebrow: "ADMIN ACTION",
          title,
          body: `<p class="caption">This action will be recorded in the activity log.</p><label class="form-field">Reason (required)<textarea id="actionReason" rows="3" required placeholder="Enter why this action is needed"></textarea></label>`,
          actions:
            '<button class="secondary" id="reasonCancel">Cancel</button><button class="primary" id="reasonConfirm">Confirm</button>',
          onReady: () => {
            document.getElementById("reasonCancel").onclick = closeModal;
            document.getElementById("reasonConfirm").onclick = () => {
              const reason = document
                .getElementById("actionReason")
                .value.trim();
              if (!reason) return toast("A reason is required.");
              callback(reason);
            };
          },
        });
      }

      function seatDialog(f, n, area = facility) {
        if (currentAdmin?.role !== "admin") return;
        const status = seatStatus(f, n, area),
          student = store.currentOccupant(f, n, area),
          session = student && store.getSession(student.uid);
        openModal({
          eyebrow: "SEAT CONTROL",
          title: key(f, n, area),
          body: `<div class="student-facts"><div><small>STATUS</small><b>${status}</b></div><div><small>AREA</small><b>${area === "lab" ? "Computer lab" : `Library · Floor ${f}`}</b></div><div><small>OCCUPANT</small><b>${student ? escapeHTML(student.name) : "No student"}</b></div><div><small>STUDENT UID</small><b>${student ? escapeHTML(student.uid) : "—"}</b></div><div><small>CHECKED IN</small><b>${session ? formatTime(session.checkedInAt) : "—"}</b></div><div><small>TIME SEATED</small><b>${session ? duration(Date.now() - session.checkedInAt) : "—"}</b></div></div>`,
          actions: `<button class="secondary" id="seatCancel">Close</button><button class="outline" id="editSeatButton">Edit seat</button>${student ? '<button class="primary" id="seatRelease">Release seat</button>' : ""}${status === "blocked" ? '<button class="outline" id="seatUnblock">Unblock</button>' : !student ? '<button class="outline" id="seatBlock">Block seat</button>' : ""}`,
          onReady: () => {
            document.getElementById("seatCancel").onclick = closeModal;
            document.getElementById("editSeatButton").onclick = () =>
              editSeatDialog(f, n, area);
            if (student)
              document.getElementById("seatRelease").onclick = () =>
                requestReason("Release this seat?", (reason) => {
                  store.endSession(student.uid, false, reason);
                  closeModal();
                  redraw();
                });
            if (status === "blocked")
              document.getElementById("seatUnblock").onclick = () =>
                requestReason("Unblock this seat?", (reason) => {
                  store.unblockSeat(f, n, reason, area);
                  closeModal();
                  redraw();
                });
            if (!student && status !== "blocked")
              document.getElementById("seatBlock").onclick = () =>
                requestReason("Block this seat?", (reason) => {
                  if (!store.blockSeat(f, n, reason, area))
                    return toast("A student is using this seat.");
                  closeModal();
                  redraw();
                });
          },
        });
      }

      function editSeatDialog(f, n, area) {
        const student = store.currentOccupant(f, n, area),
          currentStatus = seatStatus(f, n, area),
          initialFloors = area === "lab" ? [1] : [1, 2, 3];
        openModal({
          eyebrow: "EDIT SEAT",
          title: `Edit seat ${key(f, n, area)}`,
          body: `<label class="form-field">Seat number<input id="editSeatNumber" type="number" value="${n}" readonly></label><label class="form-field">Area<select id="editSeatArea"><option value="library" ${area === "library" ? "selected" : ""}>Library</option><option value="lab" ${area === "lab" ? "selected" : ""}>Computer lab</option></select></label><label class="form-field">Floor<select id="editSeatFloor">${initialFloors.map((value) => `<option value="${value}" ${value === f ? "selected" : ""}>${area === "lab" ? "Computer lab" : `Floor ${value}`}</option>`).join("")}</select></label><label class="form-field">Status<select id="editSeatStatus" ${student ? "disabled" : ""}>${student ? '<option value="occupied" selected>Occupied (active session)</option>' : `<option value="available" ${currentStatus !== "blocked" ? "selected" : ""}>Available</option><option value="blocked" ${currentStatus === "blocked" ? "selected" : ""}>Blocked</option>`}</select></label><p class="caption" id="editSeatMoveNote">${student ? "The active student session will move with this seat." : "Changing area or floor moves this seat to the next available number there."}</p><label class="form-field">Reason<textarea id="editSeatReason" rows="2" required placeholder="Enter why this seat is being edited"></textarea></label>`,
          actions:
            '<button class="secondary" id="editSeatCancel">Cancel</button><button class="primary" id="editSeatSave">Save changes</button>',
          onReady: () => {
            const areaSelect = document.getElementById("editSeatArea"),
              floorSelect = document.getElementById("editSeatFloor"),
              numberInput = document.getElementById("editSeatNumber"),
              moveNote = document.getElementById("editSeatMoveNote");
            const updateDestination = () => {
              const nextArea = areaSelect.value,
                requestedFloor = Number(floorSelect.value),
                options = nextArea === "lab" ? [1] : [1, 2, 3],
                same = nextArea === area && requestedFloor === f;
              floorSelect.innerHTML = options
                .map(
                  (value) =>
                    `<option value="${value}">${nextArea === "lab" ? "Computer lab" : `Floor ${value}`}</option>`,
                )
                .join("");
              floorSelect.value = String(
                options.includes(requestedFloor) ? requestedFloor : options[0],
              );
              const nextFloor = Number(floorSelect.value);
              numberInput.value = same
                ? n
                : store.capacity(nextArea, nextFloor) + 1;
              moveNote.textContent = student
                ? "The active student session will move with this seat."
                : same
                  ? "The seat number stays the same."
                  : "This seat moves to the next available number in the selected area.";
            };
            areaSelect.onchange = updateDestination;
            floorSelect.onchange = updateDestination;
            document.getElementById("editSeatCancel").onclick = () =>
              seatDialog(f, n, area);
            document.getElementById("editSeatSave").onclick = () => {
              if (currentAdmin?.role !== "admin")
                return toast("Admin access required.");
              const reason = document
                .getElementById("editSeatReason")
                .value.trim();
              if (!reason) return toast("Enter a reason for this edit.");
              const nextArea = areaSelect.value,
                nextFloor = Number(floorSelect.value),
                nextStatus = student
                  ? currentStatus === "blocked"
                    ? "blocked"
                    : "available"
                  : document.getElementById("editSeatStatus").value,
                result = store.editSeat(
                  area,
                  f,
                  n,
                  nextArea,
                  nextFloor,
                  nextStatus,
                  reason,
                );
              if (!result)
                return toast(
                  "Could not move this seat. Keep at least one seat in each area and check the destination capacity.",
                );
              closeModal();
              facility = nextArea;
              floor = nextFloor;
              redraw();
              toast(
                `Seat updated to ${nextArea === "lab" ? "Computer lab" : `Floor ${nextFloor}`} · ${nextFloor}-${String(result.seat).padStart(2, "0")}.`,
              );
            };
          },
        });
      }

      function renderActivity() {
        const entries = store.state.activity;
        document.getElementById("pageContent").innerHTML =
          `<article class="panel"><div class="panel-head"><div><h2>Activity log</h2><p class="caption">Shared student and admin actions · newest first</p></div><button class="outline" id="clearActivity">Clear log</button></div><div class="activity-list">${entries.map((item) => `<div class="activity-entry"><time>${new Date(item.at).toLocaleString("en-IN")}</time><b>${escapeHTML(item.action)}</b><span>${escapeHTML(item.detail)}</span><small>${escapeHTML(item.actor)}</small></div>`).join("") || '<p class="empty-state">No activity recorded yet.</p>'}</div></article>`;
        document.getElementById("clearActivity").onclick = () => {
          if (currentAdmin?.role !== "admin") return;
          store.clearActivity();
          renderActivity();
          toast("Activity log cleared.");
        };
      }

      function renderReports() {
        const active = sessions();
        const total = Object.values(store.state.capacities)
          .flatMap((area) => Object.values(area))
          .reduce((sum, count) => sum + count, 0);
        const available = total - active.length - store.state.blocked.length;
        const occupiedPct = Math.round((active.length / total) * 100);
        const daily = store.state.history.filter(
          (item) =>
            new Date(item.checkedInAt).toDateString() ===
            new Date().toDateString(),
        );
        const areas = [
          ...[1, 2, 3].map((floor) => ({
            area: "library",
            floor,
            label: "Floor " + floor,
          })),
          {
            area: "lab",
            floor: 1,
            label: "Computer lab",
          },
        ];
        const usageRows = areas
          .map((item) => {
            const capacity = store.capacity(item.area, item.floor);
            const used = Array.from(
              {
                length: capacity,
              },
              (_, index) => index + 1,
            ).filter(
              (seat) => seatStatus(item.floor, seat, item.area) !== "free",
            ).length;
            const percentage = Math.round((used / capacity) * 100);
            return `<div><span>${item.label}</span><i><b style="width:${percentage}%"></b></i><strong>${percentage}%</strong></div>`;
          })
          .join("");
        document.getElementById("pageContent").innerHTML =
          `<section class="metric-grid"><article class="metric-card"><span class="metric-label">Students in library and lab</span><strong class="metric-value">${active.length}</strong></article><article class="metric-card"><span class="metric-label">Seat utilization</span><strong class="metric-value">${occupiedPct}%</strong></article><article class="metric-card"><span class="metric-label">Sessions ended today</span><strong class="metric-value">${daily.length}</strong></article><article class="metric-card"><span class="metric-label">Seats available</span><strong class="metric-value">${available}</strong></article></section><article class="panel"><div class="panel-head"><div><h2>Usage by area</h2><p class="caption">Occupancy across library floors and computer lab</p></div><button class="outline" id="downloadCSV">Download CSV</button></div><div class="report-bars">${usageRows}</div></article>`;
        document.getElementById("downloadCSV").onclick = exportCSV;
      }

      function exportCSV() {
        if (currentAdmin?.role !== "admin")
          return toast("Admin access required.");
        const rows = [
          [
            "UID",
            "Student",
            "Department",
            "Area",
            "Seat",
            "Checked in",
            "Duration",
            "Status",
          ],
        ];
        for (const student of store.state.students) {
          const s = store.getSession(student.uid);
          rows.push([
            student.uid,
            student.name,
            student.department || "",
            s ? (s.facility === "lab" ? "Computer lab" : "Library") : "Away",
            s ? key(s.floor, s.seat, s.facility || "library") : "Away",
            s ? new Date(s.checkedInAt).toISOString() : "",
            s ? duration(Date.now() - s.checkedInAt) : "",
            s ? (s.onBreak ? "On break" : "Seated") : "Away",
          ]);
        }
        const csv = rows
          .map((row) =>
            row
              .map((cell) => {
                let value = String(cell ?? "").replace(/[\r\n]+/g, " ");
                if (/^[=+\-@]/.test(value)) value = "'" + value;
                return `"${value.replaceAll('"', '""')}"`;
              })
              .join(","),
          )
          .join("\r\n");
        const url = URL.createObjectURL(
          new Blob([csv], {
            type: "text/csv;charset=utf-8",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "haven-library-report.csv";
        a.click();
        URL.revokeObjectURL(url);
      }

      function setAdminRefresh(fn) {
        redraw = fn;
      }

      function adminTick() {
        if (!currentAdmin) return;
        document.querySelectorAll("[data-elapsed-uid]").forEach((node) => {
          const session = store.getSession(node.dataset.elapsedUid);
          if (session)
            node.textContent = duration(Date.now() - session.checkedInAt);
        });
      }

      return {
        adminNav,
        showAdminGuide,
        renderAdmin,
        setAdminRefresh,
        adminTick,
      };
    })();
  /* ===== main.js ===== */
  let studentPage = "find",
    adminPage = "overview";
  const $ = (id) => document.getElementById(id);
  const navList = () =>
    auth.current?.role === "admin" ? adminNav() : studentNav();

  function showApp(user) {
    $("loginScreen").classList.add("hidden");
    $("signupForm").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("profileName").textContent = user.name;
    $("profileRole").textContent =
      user.role === "admin" ? "Admin console" : "Student account";
    $("avatar").textContent = user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
    $("adminGuideButton").classList.toggle("hidden", user.role !== "admin");
    $("brandTagline").textContent =
      user.role === "admin" ? "LIBRARY MONITOR" : "LIBRARY SEAT FINDER";
    $("navLabel").textContent = user.role === "admin" ? "MONITOR" : "LIBRARY";
    $("topStatus").textContent =
      user.role === "admin" ? "Monitoring active" : "Live availability";
    renderNav();
    render();
  }

  function renderNav() {
    const items = navList(),
      active = auth.current?.role === "admin" ? adminPage : studentPage;
    $("navigation").innerHTML = items
      .map(
        (item) =>
          `<button class="nav-button ${item.id === active ? "active" : ""}" data-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></button>`,
      )
      .join("");
    document.querySelectorAll("[data-nav]").forEach(
      (button) =>
        (button.onclick = () => {
          const id = button.dataset.nav;
          if (auth.current.role === "admin") adminPage = id;
          else studentPage = id;
          $("profileMenu").classList.add("hidden");
          renderNav();
          render();
          $("sidebar").classList.remove("open");
        }),
    );
  }

  function render() {
    if (!auth.current) return;
    $("dateChip").textContent = formatDate();
    $("liveClock").textContent = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
    if (auth.current.role === "admin") renderAdmin(auth.current, adminPage);
    else renderStudent(auth.current, studentPage);
  }

  function showLogin() {
    auth.logout();
    $("app").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
    $("signupForm").classList.add("hidden");
    $("loginScreen").querySelector(".login-card").classList.remove("hidden");
    $("loginId").value = "";
    $("loginPassword").value = "";
  }

  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const ok = auth.signIn(
      $("loginId").value,
      $("loginPassword").value,
      $("rememberMe").checked,
    );
    if (!ok) {
      $("authError").textContent =
        "Sign-in failed. Check your email or UID and password.";
      return;
    }
    $("authError").textContent = "";
    showApp(auth.current);
  });
  $("showSignup").onclick = () => {
    $("loginScreen").classList.add("hidden");
    $("signupForm").classList.remove("hidden");
  };
  $("showLogin").onclick = () => {
    $("signupForm").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
  };
  $("signupForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const details = {
      uid: $("signupUid").value.trim(),
      name: $("signupName").value.trim(),
      email: $("signupEmail").value.trim().toLowerCase(),
      department: $("signupDepartment").value.trim(),
      year: $("signupYear").value,
      password: $("signupPassword").value,
    };
    if (details.password.length < 8) {
      $("signupError").textContent =
        "Use at least 8 characters for your password.";
      return;
    }
    const result = auth.signUp(details);
    if (result.error) {
      $("signupError").textContent = result.error;
      return;
    }
    $("signupError").textContent = "";
    showApp(result.user);
  });
  $("forgotButton").onclick = () =>
    toast(
      "Please contact your library administrator to reset your demo password.",
    );
  $("logoutButton").onclick = () => {
    showLogin();
    toast("You have been signed out.");
  };
  $("profileButton").onclick = () =>
    $("profileMenu").classList.toggle("hidden");
  $("profileDetailsButton").onclick = () => {
    const user = auth.current;
    $("profileMenu").classList.add("hidden");
    openModal({
      eyebrow: user.role === "admin" ? "ADMIN CONSOLE" : "STUDENT ACCOUNT",
      title: user.name,
      body: `<div class="student-facts"><div><small>UID</small><b>${user.uid}</b></div><div><small>ROLE</small><b>${user.role}</b></div><div><small>EMAIL</small><b>${user.email}</b></div><div><small>DEPARTMENT</small><b>${user.department || "Library"}</b></div></div>`,
      actions: '<button class="primary" id="profileDone">Close</button>',
      onReady: () => ($("profileDone").onclick = closeModal),
    });
  };
  $("adminGuideButton").onclick = showAdminGuide;
  $("themeButton").onclick = toggleTheme;
  $("notificationButton").onclick = () => {
    if (auth.current?.role !== "admin") {
      toast("You’re all caught up.");
      return;
    }
    const active = store.state.students
        .map((student) => store.getSession(student.uid))
        .filter(Boolean),
      onBreak = active.filter((session) => session.onBreak).length,
      blocked = store.state.blocked.length;
    adminPage = "overview";
    renderNav();
    render();
    toast(
      onBreak || blocked
        ? `${onBreak} student${onBreak === 1 ? "" : "s"} on break · ${blocked} blocked seat${blocked === 1 ? "" : "s"}`
        : "No active admin alerts.",
    );
  };
  $("menuToggle").onclick = () => $("sidebar").classList.toggle("open");
  $("modalX").onclick = closeModal;
  $("modalBackdrop").addEventListener("click", (event) => {
    if (event.target === $("modalBackdrop")) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      $("profileMenu").classList.add("hidden");
      $("sidebar").classList.remove("open");
    }
  });
  setStudentRefresh(() => {
    if (auth.current?.role === "student") render();
  });
  setAdminRefresh(() => {
    if (auth.current?.role === "admin") render();
  });
  subscribe(() => {
    if (auth.current) {
      renderNav();
      render();
      toast("Haven updated from another tab.");
    }
  });
  initializeTheme();
  const restored = auth.restore();
  if (restored) showApp(restored);
  setInterval(() => {
    if (!auth.current) return;
    $("liveClock").textContent = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
    if (auth.current.role === "student") studentTick(auth.current);
    else adminTick();
  }, 1000);
})();
