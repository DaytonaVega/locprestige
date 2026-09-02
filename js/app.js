const state = {
  category: "all",
  from: "",
  to: "",
  pick: "from",
  hover: "",
  calCursor: startOfMonth(new Date()),
  vehicleId: "",
};

const labels = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const els = {
  filters: document.getElementById("filters"),
  vehicleGrid: document.getElementById("vehicleGrid"),
  modal: document.getElementById("vehicleModal"),
  modalClose: document.getElementById("modalClose"),
  dateFrom: document.getElementById("dateFrom"),
  dateTo: document.getElementById("dateTo"),
  datebar: document.getElementById("reserver"),
  dateBook: document.getElementById("dateBook"),
  heroCalendar: document.getElementById("heroCalendar"),
  dateFromBtn: document.getElementById("dateFromBtn"),
  dateToBtn: document.getElementById("dateToBtn"),
  dateFromText: document.getElementById("dateFromText"),
  dateToText: document.getElementById("dateToText"),
  modalFromBtn: document.getElementById("modalFromBtn"),
  modalToBtn: document.getElementById("modalToBtn"),
  modalFromText: document.getElementById("modalFromText"),
  modalToText: document.getElementById("modalToText"),
  calendar: document.getElementById("modalCalendar"),
  bookNote: document.getElementById("modalBookNote"),
  booking: document.getElementById("bookingModal"),
  bookingForm: document.getElementById("bookingForm"),
  bookingRecap: document.getElementById("bookingRecap"),
  bookingError: document.getElementById("bookingError"),
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function iso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(value) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function formatLong(value) {
  const date = parseDay(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function money(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function kmLabel(km) {
  return `${new Intl.NumberFormat("fr-FR").format(km)} km`;
}

function bookedRanges(v) {
  return (v.booked || []).map((b) => ({ from: parseDay(b.from), to: parseDay(b.to) }));
}

function dayBooked(v, date) {
  return bookedRanges(v).some((b) => date >= b.from && date <= b.to);
}

function rangeBusy(v, from, to) {
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end || end < start) return false;
  return bookedRanges(v).some((b) => start <= b.to && end >= b.from);
}

function isBusyNow(v) {
  return dayBooked(v, parseDay(iso(new Date())));
}

function nextBooking(v) {
  const today = parseDay(iso(new Date()));
  return bookedRanges(v)
    .filter((b) => b.to >= today)
    .sort((a, b) => a.from - b.from)[0];
}

function vehicleStatus(v) {
  if (state.from && state.to) {
    if (!rangeBusy(v, state.from, state.to)) {
      return { kind: "free", badge: "Disponible", label: "Disponible sur ces dates" };
    }
    if (isBusyNow(v) && rangeBusy(v, state.from, state.to)) {
      const current = bookedRanges(v).find((b) => parseDay(iso(new Date())) >= b.from && parseDay(iso(new Date())) <= b.to);
      const overlapsNow = current && parseDay(state.from) <= current.to && parseDay(state.to) >= current.from;
      if (overlapsNow) {
        const today = iso(new Date());
        if (current && iso(current.to) === today) {
          return { kind: "soon", badge: "Dispo demain", label: "Disponible à partir de demain" };
        }
        return {
          kind: "out",
          badge: "En location",
          label: `En location jusqu’au ${formatLong(iso(current.to))}`,
        };
      }
    }
    return { kind: "reserved", badge: "Réservé", label: "Déjà réservé sur ces dates" };
  }
  if (isBusyNow(v)) {
    const current = bookedRanges(v).find((b) => parseDay(iso(new Date())) >= b.from && parseDay(iso(new Date())) <= b.to);
    const today = iso(new Date());
    if (current && iso(current.to) === today) {
      return { kind: "soon", badge: "Dispo demain", label: "Disponible à partir de demain" };
    }
    return {
      kind: "out",
      badge: "En location",
      label: current ? `En location jusqu’au ${formatLong(iso(current.to))}` : "Actuellement en location",
    };
  }
  const next = nextBooking(v);
  if (next) {
    return {
      kind: "reserved",
      badge: "Réservé",
      label: `Réservé du ${formatLong(iso(next.from))} au ${formatLong(iso(next.to))}`,
    };
  }
  return { kind: "free", badge: "Disponible", label: "Disponible" };
}

function priceInner(v) {
  if (v.priceWeek && v.priceWeekend) {
    return `<strong>${money(v.priceWeek)}</strong> / jour en semaine <span>${money(v.priceWeekend)} / jour le week-end · Caution ${money(v.deposit)}</span>`;
  }
  if (v.price) {
    const dep = v.deposit ? ` <span>Caution ${money(v.deposit)}</span>` : "";
    return `<strong>${money(v.price)}</strong> / jour${dep}`;
  }
  return "";
}

function priceBadge(v) {
  const value = v.priceWeek || v.price;
  if (!value) return "";
  const note = v.priceWeek ? "dès" : "";
  return `<p class="price-badge">${note ? `<em>${note}</em>` : ""}<strong>${money(value)}</strong><span>/ jour</span></p>`;
}

function mailHref(car) {
  const subject = encodeURIComponent(
    car && state.from && state.to
      ? `Location ${car} — ${formatLong(state.from)} au ${formatLong(state.to)}`
      : car
        ? `Location ${car}`
        : "Location KR Location"
  );
  const body = encodeURIComponent(
    car && state.from && state.to
      ? `Bonjour,\n\nJe souhaite réserver la ${car} du ${formatLong(state.from)} au ${formatLong(state.to)}.\n\n`
      : "Bonjour,\n\nJe souhaite réserver un véhicule.\n\n"
  );
  return `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
}

function fillContacts(car) {
  document.querySelectorAll("#snapLink, #snapFooter, #snapAgency").forEach((el) => {
    if (el) el.href = CONTACT.snapUrl;
  });
  document.querySelectorAll("#mailLink, #mailFooter, #mailAgency").forEach((el) => {
    if (el) el.href = mailHref(car);
  });
}

function renderTicker() {
  const el = document.getElementById("fleetTicker");
  if (!el) return;
  const items = VEHICLES.map((v) => `<span>${v.name}</span>`).join("");
  el.innerHTML = `${items}${items}`;
}

function dailyPrice(v) {
  return v.priceWeek || v.price || 0;
}

function list() {
  return VEHICLES.filter((v) => state.category === "all" || v.category === state.category).sort(
    (a, b) => dailyPrice(b) - dailyPrice(a) || (b.deposit || 0) - (a.deposit || 0)
  );
}

function renderFilters() {
  els.filters.innerHTML = CATEGORIES.map(
    (c) =>
      `<button type="button" class="${c.id === state.category ? "active" : ""}" data-category="${c.id}">${c.label}</button>`
  ).join("");
}

function renderFleet() {
  const items = list();
  if (!items.length) {
    els.vehicleGrid.innerHTML = `<p class="empty">Aucun véhicule dans cette catégorie.</p>`;
    return;
  }

  els.vehicleGrid.innerHTML = items
    .map((v, i) => {
      const status = vehicleStatus(v);
      const featured = state.category === "all" && i === 0 ? " is-featured" : "";
      return `
      <article class="card${v.photoFit === "contain" ? " photo-contain" : ""}${featured}" data-open="${v.id}" data-reveal>
        <div class="media">
          <img src="${v.image}" alt="${v.name}" loading="lazy" draggable="false" />
          <p class="status-badge${status.kind === "out" ? " is-out" : status.kind === "reserved" ? " is-busy" : status.kind === "soon" ? " is-soon" : ""}">${status.badge}</p>
          ${priceBadge(v)}
        </div>
        <div class="body">
          <p class="tag">${labels[v.category]}</p>
          <h3>${v.name}</h3>
          <p class="meta">${v.seats} places · ${kmLabel(v.km)} · ${v.transmission} · ${v.fuel}${v.power ? ` · ${v.power}` : ""}</p>
          <p class="meta">${status.label}</p>
          <p class="more">Réserver</p>
        </div>
      </article>`;
    })
    .join("");

  observeReveals(els.vehicleGrid);
}

function renderCount() {
  const countEl = document.getElementById("fleetCount");
  const statuses = VEHICLES.map(vehicleStatus);
  const out = statuses.filter((s) => s.kind === "out").length;
  const reserved = statuses.filter((s) => s.kind === "reserved").length;
  const soon = statuses.filter((s) => s.kind === "soon").length;
  const free = statuses.filter((s) => s.kind === "free").length;
  if (countEl) {
    countEl.textContent = state.from && state.to
      ? `${free} disponible${free > 1 ? "s" : ""} · ${out + reserved + soon} indisponible${out + reserved + soon > 1 ? "s" : ""}`
      : `${VEHICLES.length} véhicules · ${out} en location · ${soon} dès demain`;
  }
  const heroFleet = document.getElementById("heroFleet");
  if (heroFleet) {
    heroFleet.textContent = `${VEHICLES.length} véhicule${VEHICLES.length > 1 ? "s" : ""}`;
  }
}

function dateLabel(value) {
  return formatLong(value) || "Ajouter une date";
}

function previewEnd() {
  if (state.pick === "to" && state.from && state.hover && state.hover >= state.from) {
    return state.hover;
  }
  return state.to || "";
}

function calendarEnds() {
  return { start: state.from || "", end: previewEnd() };
}

function dayClasses(value, booked) {
  const { start, end } = calendarEnds();
  if (booked) return { picked: false, inRange: false };
  const isStart = Boolean(start && value === start);
  const isEnd = Boolean(end && value === end);
  return {
    picked: isStart || isEnd,
    inRange: Boolean(start && end && value >= start && value <= end),
  };
}

function markCalendarDay(btn) {
  const booked = btn.classList.contains("is-booked");
  const mark = dayClasses(btn.dataset.day, booked);
  btn.classList.toggle("is-picked", mark.picked);
  btn.classList.toggle("is-range", mark.inRange);
}

function updateCalendarHighlights() {
  [els.calendar, els.heroCalendar].forEach((el) => {
    el?.querySelectorAll("[data-day]").forEach(markCalendarDay);
  });
  const shownTo = previewEnd();
  if (els.dateToText) els.dateToText.textContent = dateLabel(shownTo);
  if (els.modalToText) els.modalToText.textContent = dateLabel(shownTo);
  updateDateHint();
}

function updateDateHint() {
  const hint = document.getElementById("dateBookHint");
  if (!hint) return;
  const shownTo = previewEnd();
  if (!state.from) {
    hint.textContent = "Choisissez d’abord le jour de prise en charge, puis glissez jusqu’au retour.";
  } else if (!state.to) {
    hint.textContent = shownTo
      ? `Retour le ${formatLong(shownTo)}. Cliquez pour confirmer.`
      : `Prise en charge le ${formatLong(state.from)}. Glissez jusqu’au jour de retour.`;
  } else {
    hint.textContent = `${formatLong(state.from)} → ${formatLong(state.to)}`;
  }
}

function syncDateInputs() {
  if (els.dateFrom) els.dateFrom.value = state.from;
  if (els.dateTo) els.dateTo.value = state.to;
  if (els.dateFromText) els.dateFromText.textContent = dateLabel(state.from);
  if (els.dateToText) els.dateToText.textContent = dateLabel(previewEnd());
  if (els.modalFromText) els.modalFromText.textContent = dateLabel(state.from);
  if (els.modalToText) els.modalToText.textContent = dateLabel(previewEnd());
  [els.dateFromBtn, els.modalFromBtn].forEach((btn) => btn?.classList.toggle("is-on", state.pick === "from"));
  [els.dateToBtn, els.modalToBtn].forEach((btn) => btn?.classList.toggle("is-on", state.pick === "to"));
  updateDateHint();
}

function setDates(from, to) {
  state.from = from || "";
  state.to = to && from && to < from ? from : to || "";
  if (state.to) state.hover = "";
  syncDateInputs();
  renderFleet();
  renderCount();
  if (state.vehicleId) refreshModalBooking();
  else renderCalendar();
  if (els.booking?.open) fillBookingRecap();
}

function currentVehicle() {
  return VEHICLES.find((item) => item.id === state.vehicleId);
}

function paintCalendar(el, vehicle) {
  if (!el) return;
  const cursor = state.calCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startIndex = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startIndex; i += 1) cells.push(`<span></span>`);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = `${year}-${pad(month + 1)}-${pad(day)}`;
    const date = parseDay(value);
    const today = parseDay(iso(new Date()));
    const booked = vehicle ? dayBooked(vehicle, date) : false;
    const past = date < today;
    const mark = dayClasses(value, booked);
    const isToday = value === iso(new Date());
    const cls = [
      past || booked ? "is-muted" : "",
      booked ? "is-booked" : "",
      mark.picked ? "is-picked" : "",
      mark.inRange ? "is-range" : "",
      isToday ? "is-today" : "",
    ]
      .filter(Boolean)
      .join(" ");
    cells.push(
      `<button type="button" class="${cls}" data-day="${value}" ${past || booked ? "disabled" : ""}>${day}</button>`
    );
  }

  el.innerHTML = `
    <div class="cal-head">
      <button type="button" data-cal="-1" aria-label="Mois précédent">‹</button>
      <strong>${MONTHS[month]} ${year}</strong>
      <button type="button" data-cal="1" aria-label="Mois suivant">›</button>
    </div>
    <div class="cal-week">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="cal-days">${cells.join("")}</div>
  `;
}

function renderCalendar() {
  paintCalendar(els.calendar, currentVehicle());
  paintCalendar(els.heroCalendar, null);
}

function bindCalendarHover(el) {
  if (!el || el.dataset.hoverBound === "1") return;
  el.dataset.hoverBound = "1";
  el.addEventListener("pointerover", (e) => {
    const day = e.target.closest("[data-day]");
    if (!day || day.disabled) return;
    if (state.hover === day.dataset.day) return;
    state.hover = day.dataset.day;
    updateCalendarHighlights();
  });
  el.addEventListener("pointerleave", () => {
    if (!state.hover) return;
    state.hover = "";
    updateCalendarHighlights();
  });
}

function openDateBook(pick) {
  state.pick = pick || "from";
  if (els.dateBook) {
    els.dateBook.hidden = false;
    els.datebar.classList.add("is-open");
  }
  syncDateInputs();
  renderCalendar();
}

function closeDateBook() {
  state.hover = "";
  if (els.dateBook) els.dateBook.hidden = true;
  if (els.datebar) els.datebar.classList.remove("is-open");
}

function pickDay(value) {
  state.hover = "";
  if (state.pick === "to" && state.from && value >= state.from) {
    state.pick = "from";
    setDates(state.from, value);
    return;
  }
  if (!state.from || (state.from && state.to) || value < state.from) {
    state.pick = "to";
    setDates(value, "");
    return;
  }
  state.pick = "from";
  setDates(state.from, value);
}

function refreshModalBooking() {
  const v = currentVehicle();
  if (!v) return;
  const status = vehicleStatus(v);
  const statusEl = document.getElementById("modalStatus");
  statusEl.textContent = status.label;
  statusEl.classList.toggle("is-out", status.kind === "out");
  statusEl.classList.toggle("is-busy", status.kind === "reserved");
  statusEl.classList.toggle("is-soon", status.kind === "soon");
  const conflict = state.from && state.to && rangeBusy(v, state.from, state.to);
  els.bookNote.textContent = conflict
    ? "Ces dates sont déjà prises. Choisissez un autre créneau."
    : state.from && state.to
      ? `Demande pour ${formatLong(state.from)} → ${formatLong(state.to)}.`
      : state.from
        ? `Prise en charge le ${formatLong(state.from)}. Choisissez le jour de retour.`
        : "Sélectionnez une prise en charge, puis un retour.";
  els.bookNote.classList.toggle("is-busy", conflict);
  const box = els.modal.querySelector(".contact-box");
  if (box) box.classList.toggle("is-disabled", conflict);
  const continueBtn = document.getElementById("openBookingBtn");
  if (continueBtn) continueBtn.disabled = !state.from || !state.to || conflict;
  fillContacts(v.name);
  renderCalendar();
}

let gallery = [];
let galleryIndex = 0;

function showSlide(index) {
  if (!gallery.length) return;
  galleryIndex = (index + gallery.length) % gallery.length;
  const main = document.getElementById("modalImage");
  main.src = gallery[galleryIndex];
  els.modal.querySelectorAll(".thumb").forEach((b, i) => b.classList.toggle("active", i === galleryIndex));
}

function openVehicle(id) {
  const v = VEHICLES.find((item) => item.id === id);
  if (!v) return;
  state.vehicleId = id;
  gallery = v.images && v.images.length ? v.images : [v.image];
  galleryIndex = 0;
  const main = document.getElementById("modalImage");
  main.src = gallery[0];
  main.alt = v.name;
  document.getElementById("modalCategory").textContent = labels[v.category];
  document.getElementById("modalName").textContent = v.name;
  const kmEl = document.getElementById("modalKm");
  if (v.km) {
    kmEl.hidden = false;
    kmEl.textContent = kmLabel(v.km);
  } else {
    kmEl.hidden = true;
    kmEl.textContent = "";
  }
  document.getElementById("modalBlurb").textContent = v.blurb;
  const pricing = document.getElementById("modalPricing");
  const price = priceInner(v);
  if (price) {
    pricing.hidden = false;
    pricing.innerHTML = price;
  } else {
    pricing.hidden = true;
    pricing.textContent = "";
  }
  const extra = [
    v.year ? `<li><span>Année</span><strong>${v.year}</strong></li>` : "",
    v.battery ? `<li><span>Batterie</span><strong>${v.battery}</strong></li>` : "",
    v.km ? `<li><span>Kilométrage</span><strong>${kmLabel(v.km)}</strong></li>` : "",
  ].join("");
  document.getElementById("modalSpecs").innerHTML = `
    ${extra}
    <li><span>Places</span><strong>${v.seats}</strong></li>
    ${v.power ? `<li><span>Puissance</span><strong>${v.power}</strong></li>` : ""}
    <li><span>Boîte</span><strong>${v.transmission}</strong></li>
    <li><span>Énergie</span><strong>${v.fuel}</strong></li>
  `;
  document.getElementById("modalThumbs").innerHTML = gallery
    .map(
      (src, i) =>
        `<button type="button" class="thumb${i === 0 ? " active" : ""}" data-src="${src}" data-index="${i}"><img src="${src}" alt="" draggable="false" /></button>`
    )
    .join("");
  els.modal.classList.toggle("photo-contain", v.photoFit === "contain");
  const hasMany = gallery.length > 1;
  document.getElementById("modalPrev")?.toggleAttribute("hidden", !hasMany);
  document.getElementById("modalNext")?.toggleAttribute("hidden", !hasMany);
  syncDateInputs();
  refreshModalBooking();
  els.modal.showModal();
}

function observeReveals(root = document) {
  const nodes = [...root.querySelectorAll("[data-reveal]:not(.is-in)")];
  if (!nodes.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -36px 0px" }
  );
  nodes.forEach((el, i) => {
    el.style.setProperty("--d", `${(i % 6) * 70}ms`);
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) el.classList.add("is-in");
    else io.observe(el);
  });
}

els.filters.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-category]");
  if (!btn) return;
  state.category = btn.dataset.category;
  renderFilters();
  renderFleet();
});

els.vehicleGrid.addEventListener("click", (e) => {
  const card = e.target.closest("[data-open]");
  if (card) openVehicle(card.dataset.open);
});

els.modalClose.addEventListener("click", () => els.modal.close());

els.modal.addEventListener("click", (e) => {
  if (e.target === els.modal) els.modal.close();
  const thumb = e.target.closest(".thumb");
  if (thumb) {
    showSlide(Number(thumb.dataset.index));
  }
  if (e.target.closest("#modalPrev")) showSlide(galleryIndex - 1);
  if (e.target.closest("#modalNext")) showSlide(galleryIndex + 1);
  const shift = e.target.closest("[data-cal]");
  if (shift) {
    state.calCursor = addMonths(state.calCursor, Number(shift.dataset.cal));
    renderCalendar();
  }
  const day = e.target.closest("[data-day]");
  if (day && !day.disabled) pickDay(day.dataset.day);
});

els.datebar.addEventListener("click", (e) => {
  e.stopPropagation();
  if (e.target.closest(".datebar-label")) {
    openDateBook(state.from && !state.to ? "to" : "from");
    return;
  }
  const field = e.target.closest("[data-pick]");
  if (field) {
    openDateBook(field.dataset.pick);
    return;
  }
  const shift = e.target.closest("[data-cal]");
  if (shift) {
    state.calCursor = addMonths(state.calCursor, Number(shift.dataset.cal));
    renderCalendar();
    return;
  }
  const day = e.target.closest("[data-day]");
  if (day && !day.disabled) pickDay(day.dataset.day);
});

els.datebar.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!state.from || !state.to) {
    openDateBook(state.from ? "to" : "from");
    return;
  }
  closeDateBook();
  document.getElementById("flotte").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.addEventListener("click", (e) => {
  if (!els.datebar || !els.datebar.classList.contains("is-open")) return;
  const path = typeof e.composedPath === "function" ? e.composedPath() : [];
  if (path.includes(els.datebar) || els.datebar.contains(e.target)) return;
  if (e.target.closest("#bookingCta")) return;
  closeDateBook();
});

[els.modalFromBtn, els.modalToBtn].forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => {
    state.pick = btn.dataset.pick;
    syncDateInputs();
  });
});

const header = document.getElementById("siteHeader");
const menuBtn = document.getElementById("menuBtn");
const siteNav = document.getElementById("siteNav");

function onHeaderScroll() {
  header?.classList.toggle("is-scrolled", window.scrollY > 16);
}

onHeaderScroll();
window.addEventListener("scroll", onHeaderScroll, { passive: true });

function closeMenu() {
  header?.classList.remove("is-open");
  document.body.classList.remove("nav-open");
  menuBtn?.setAttribute("aria-expanded", "false");
  menuBtn?.setAttribute("aria-label", "Ouvrir le menu");
}

menuBtn?.addEventListener("click", () => {
  const open = header.classList.toggle("is-open");
  document.body.classList.toggle("nav-open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
});

siteNav?.addEventListener("click", (e) => {
  if (e.target.closest("a")) closeMenu();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
  if (!els.modal.open || !gallery.length) return;
  if (e.key === "ArrowLeft") showSlide(galleryIndex - 1);
  if (e.key === "ArrowRight") showSlide(galleryIndex + 1);
});

function isFleetPhoto(target) {
  return Boolean(target.closest(".card .media, .sheet-photo, .thumb"));
}

document.addEventListener("contextmenu", (e) => {
  if (isFleetPhoto(e.target)) e.preventDefault();
});

document.addEventListener("dragstart", (e) => {
  if (isFleetPhoto(e.target)) e.preventDefault();
});

const FILE_MAX = 8 * 1024 * 1024;
const FILE_KEYS = ["permis_recto", "permis_verso"];
const STEP_FIELDS = {
  1: ["vehicule", "nom", "prenom", "telephone", "adresse"],
  2: ["permis_recto", "permis_verso"],
};

let bookingStep = 1;
const filePreviews = new Map();

function fillBookingRecap() {
  if (!els.bookingRecap) return;
  const id = els.bookingForm?.elements.vehicule_id.value || els.bookingForm?.elements.vehicule.value;
  const v = VEHICLES.find((item) => item.id === id);
  const dates = state.from && state.to ? `${formatLong(state.from)} → ${formatLong(state.to)}` : "Dates à choisir";
  els.bookingRecap.textContent = v ? `${v.name} · ${dates}` : dates;
}

function bookingVehicleOptions(selected) {
  const empty = `<option value="">Choisir un véhicule</option>`;
  return (
    empty +
    VEHICLES.map((v) => {
      const busy = state.from && state.to && rangeBusy(v, state.from, state.to);
      const on = v.id === selected ? " selected" : "";
      const off = busy && v.id !== selected ? " disabled" : "";
      return `<option value="${v.id}"${on}${off}>${v.name}${busy ? " — indisponible" : ""}</option>`;
    }).join("")
  );
}

function setBookingStep(step) {
  const changed = bookingStep !== step;
  bookingStep = step;
  els.bookingForm?.querySelectorAll(".booking-pane").forEach((pane) => {
    pane.classList.toggle("is-on", Number(pane.dataset.pane) === step);
  });
  document.querySelectorAll("#bookingSteps li").forEach((item, index) => {
    const n = index + 1;
    item.classList.toggle("is-on", n === step);
    item.classList.toggle("is-done", n < step);
  });
  const back = document.getElementById("bookingBack");
  const next = document.getElementById("bookingNextBtn");
  const submit = document.getElementById("bookingSubmit");
  if (back) back.hidden = step === 1;
  if (next) next.hidden = step === 2;
  if (submit) submit.hidden = step !== 2;
  if (changed && els.bookingError) els.bookingError.textContent = "";
  if (step === 2) fillSendRecap();
  document.getElementById("bookingFormWrap")?.querySelector(".booking-head")?.scrollIntoView({ block: "nearest" });
}

function resetFileFields() {
  els.bookingForm?.querySelectorAll(".file-field").forEach((field) => {
    field.classList.remove("has-file");
    const name = field.querySelector("[data-file-name]");
    if (name) name.textContent = "Ajouter une photo";
    const preview = field.querySelector("[data-file-preview]");
    if (preview) {
      preview.hidden = true;
      preview.removeAttribute("src");
    }
  });
  filePreviews.forEach((url) => URL.revokeObjectURL(url));
  filePreviews.clear();
}

function resetBooking() {
  if (!els.bookingForm) return;
  stripLegacyBookingFields();
  els.bookingForm.reset();
  resetFileFields();
  if (els.bookingError) els.bookingError.textContent = "";
  document.getElementById("bookingFormWrap").hidden = false;
  document.getElementById("bookingDone").hidden = true;
  els.booking.querySelector(".booking-sheet")?.classList.remove("is-sending");
  const submit = document.getElementById("bookingSubmit");
  if (submit) {
    submit.disabled = false;
    submit.textContent = "Envoyer le dossier";
  }
  setBookingStep(1);
}

function openBooking(vehicleId) {
  if (!state.from || !state.to) {
    if (els.modal?.open) {
      els.bookNote.textContent = "Sélectionnez une prise en charge, puis un retour.";
      els.bookNote.classList.add("is-busy");
      return;
    }
    document.getElementById("reserver")?.scrollIntoView({ behavior: "smooth", block: "start" });
    openDateBook(state.from ? "to" : "from");
    return;
  }
  const chosen = vehicleId || state.vehicleId || "";
  const v = VEHICLES.find((item) => item.id === chosen);
  if (v && rangeBusy(v, state.from, state.to)) {
    if (els.bookNote) {
      els.bookNote.textContent = "Ces dates sont déjà prises. Choisissez un autre créneau.";
      els.bookNote.classList.add("is-busy");
    }
    return;
  }
  resetBooking();
  const select = document.getElementById("bookingVehicle");
  if (select) select.innerHTML = bookingVehicleOptions(chosen);
  if (els.bookingForm) {
    els.bookingForm.elements.vehicule_id.value = chosen;
    if (chosen) els.bookingForm.elements.vehicule.value = chosen;
  }
  fillBookingRecap();
  if (els.modal?.open) els.modal.close();
  els.booking.showModal();
}

async function compressImage(file) {
  if (file.type === "application/pdf") {
    if (file.size > FILE_MAX) throw new Error("size");
    return file;
  }
  if (!file.type.startsWith("image/")) throw new Error("type");
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("type");
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

function emptyField(name) {
  const el = els.bookingForm.elements[name];
  if (!el) return false;
  if (el.type === "checkbox") return !el.checked;
  if (el.type === "file") return !el.files[0];
  return !String(el.value || "").trim();
}

function stripLegacyBookingFields() {
  const form = els.bookingForm;
  if (!form) return;
  const kill = [
    "permis_numero",
    "permis_date",
    "genre",
    "date_naissance",
    "email",
    "code_postal",
    "ville",
    "type_piece",
    "piece_numero",
    "piece_recto",
    "piece_verso",
    "consentement",
  ];
  for (const name of kill) {
    const el = form.elements[name];
    if (!el) continue;
    el.required = false;
    el.closest("label, .field, .file-field, .check")?.remove();
  }
}

function stepIncomplete(step) {
  return STEP_FIELDS[step].some((name) => emptyField(name));
}

function missingRequired() {
  return [1, 2].some(stepIncomplete);
}

function fillSendRecap() {
  const box = document.getElementById("bookingSendRecap");
  if (!box || !els.bookingForm) return;
  const form = els.bookingForm;
  const v = VEHICLES.find((item) => item.id === form.elements.vehicule.value);
  const files = FILE_KEYS.filter((key) => Boolean(form.elements[key]?.files[0])).length;
  const driver = [form.elements.prenom.value, form.elements.nom.value].filter(Boolean).join(" ");
  const phone = form.elements.telephone.value.trim();
  const address = form.elements.adresse.value.trim();
  box.innerHTML = `
    <li><span>Véhicule</span><strong>${v ? v.name : "—"}</strong></li>
    <li><span>Dates</span><strong>${state.from && state.to ? `${formatLong(state.from)} → ${formatLong(state.to)}` : "—"}</strong></li>
    <li><span>Conducteur</span><strong>${driver || "—"}</strong></li>
    <li><span>Téléphone</span><strong>${phone || "—"}</strong></li>
    <li><span>Adresse</span><strong>${address || "—"}</strong></li>
    <li><span>Pièces jointes</span><strong>${files} photo${files > 1 ? "s" : ""} — permis recto et verso</strong></li>
    <li><span>Destination</span><strong>E-mail de KR Location</strong></li>
  `;
}

function dossierReturnUrl() {
  const url = new URL(location.href);
  url.searchParams.set("dossier", "ok");
  url.hash = "";
  return url.toString();
}

function showDossierToast() {
  const toast = document.getElementById("dossierToast");
  if (!toast) return;
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 7000);
}

function showBookingDone() {
  document.getElementById("bookingFormWrap").hidden = true;
  document.getElementById("bookingDone").hidden = false;
}

function putFile(input, file) {
  const data = new DataTransfer();
  data.items.add(file);
  input.files = data.files;
}

function prepareMailFields(v, form) {
  const subject = `Demande de location — ${v.name} — ${formatLong(state.from)} au ${formatLong(state.to)}`;
  const subjectEl = document.getElementById("bookingSubject");
  const nextEl = document.getElementById("bookingNext");
  const fromEl = document.getElementById("bookingFromField");
  const toEl = document.getElementById("bookingToField");
  const nameEl = document.getElementById("bookingVehicleName");
  if (subjectEl) subjectEl.value = subject;
  if (nextEl) nextEl.value = dossierReturnUrl();
  if (fromEl) fromEl.value = formatLong(state.from);
  if (toEl) toEl.value = formatLong(state.to);
  if (nameEl) nameEl.value = v.name;
  form.action = `https://formsubmit.co/${encodeURIComponent(CONTACT.email)}`;
  form.method = "POST";
  form.enctype = "multipart/form-data";
}

async function submitBooking(e) {
  e.preventDefault();
  const form = els.bookingForm;
  els.bookingError.textContent = "";
  if (form.elements._honey.value) {
    showBookingDone();
    return;
  }
  if (bookingStep < 2) {
    goBookingNext();
    return;
  }
  if (!state.from || !state.to) {
    els.bookingError.textContent = "Choisissez d’abord vos dates.";
    return;
  }
  const vehicleId = form.elements.vehicule.value;
  form.elements.vehicule_id.value = vehicleId;
  const v = VEHICLES.find((item) => item.id === vehicleId);
  if (!v) {
    setBookingStep(1);
    els.bookingError.textContent = "Choisissez un véhicule.";
    return;
  }
  if (rangeBusy(v, state.from, state.to)) {
    els.bookingError.textContent = "Ces dates sont déjà prises. Choisissez un autre créneau.";
    return;
  }
  if (missingRequired()) {
    if (stepIncomplete(1)) setBookingStep(1);
    else if (stepIncomplete(2)) setBookingStep(2);
    els.bookingError.textContent = "Remplissez les infos et ajoutez les photos du permis, recto et verso.";
    return;
  }
  const submit = document.getElementById("bookingSubmit");
  const sheet = form.closest(".booking-sheet");
  submit.disabled = true;
  submit.textContent = "Envoi…";
  sheet?.classList.add("is-sending");
  try {
    for (const key of FILE_KEYS) {
      const file = form.elements[key].files[0];
      if (!file) throw new Error("files");
      if (file.size > FILE_MAX) throw new Error("size");
      putFile(form.elements[key], await compressImage(file));
    }
    prepareMailFields(v, form);
    const data = new FormData(form);
    data.delete("_honey");
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT.email)}`, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });
    const json = await res.json().catch(() => ({}));
    const ok = res.ok && (json.success === true || json.success === "true");
    if (ok) {
      showBookingDone();
      return;
    }
    form.submit();
  } catch (err) {
    if (err?.message === "size") {
      setBookingStep(2);
      els.bookingError.textContent = "Un fichier dépasse 8 Mo. Compressez-le ou prenez une photo plus légère.";
    } else {
      prepareMailFields(v, form);
      form.submit();
      return;
    }
  } finally {
    submit.disabled = false;
    submit.textContent = "Envoyer le dossier";
    sheet?.classList.remove("is-sending");
  }
}

function goBookingNext() {
  if (bookingStep === 1) {
    if (stepIncomplete(1)) {
      els.bookingError.textContent = "Complétez l’identité et le véhicule.";
      return;
    }
    setBookingStep(2);
  }
}

function markFileField(input) {
  const field = input.closest(".file-field");
  const file = input.files[0];
  const name = field?.querySelector("[data-file-name]");
  const preview = field?.querySelector("[data-file-preview]");
  if (filePreviews.has(input)) {
    URL.revokeObjectURL(filePreviews.get(input));
    filePreviews.delete(input);
  }
  if (file && file.size > FILE_MAX) {
    input.value = "";
    if (name) name.textContent = "Fichier trop lourd (8 Mo max)";
    field?.classList.remove("has-file");
    if (preview) {
      preview.hidden = true;
      preview.removeAttribute("src");
    }
    return;
  }
  if (name) name.textContent = file ? file.name : "Ajouter une photo";
  field?.classList.toggle("has-file", Boolean(file));
  if (preview) {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      filePreviews.set(input, url);
      preview.src = url;
      preview.hidden = false;
    } else {
      preview.hidden = true;
      preview.removeAttribute("src");
    }
  }
  if (bookingStep === 2) fillSendRecap();
}

els.bookingForm?.querySelectorAll("input[type=file]").forEach((input) => {
  input.addEventListener("change", () => markFileField(input));
});

els.bookingForm?.elements.vehicule?.addEventListener("change", () => {
  els.bookingForm.elements.vehicule_id.value = els.bookingForm.elements.vehicule.value;
  fillBookingRecap();
});

els.bookingForm?.addEventListener("submit", submitBooking);
document.getElementById("bookingNextBtn")?.addEventListener("click", goBookingNext);
document.getElementById("bookingBack")?.addEventListener("click", () => setBookingStep(Math.max(1, bookingStep - 1)));
document.getElementById("bookingClose")?.addEventListener("click", () => els.booking.close());
document.getElementById("bookingDoneClose")?.addEventListener("click", () => els.booking.close());
els.booking?.addEventListener("click", (e) => {
  if (e.target === els.booking) els.booking.close();
});
els.booking?.addEventListener("close", resetBooking);
document.getElementById("openBookingBtn")?.addEventListener("click", () => openBooking(state.vehicleId));
document.getElementById("bookingCta")?.addEventListener("click", (e) => {
  e.stopPropagation();
  openBooking(state.vehicleId);
});

if (new URLSearchParams(location.search).get("dossier") === "ok") {
  showDossierToast();
  const clean = new URL(location.href);
  clean.searchParams.delete("dossier");
  history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
}

syncDateInputs();
fillContacts();
renderFilters();
renderFleet();
renderCount();
renderTicker();
bindCalendarHover(els.heroCalendar);
bindCalendarHover(els.calendar);

observeReveals();

function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) loader.classList.add("is-done");
}

window.setTimeout(hideLoader, 900);
