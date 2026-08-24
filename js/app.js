const state = {
  category: "all",
  from: "",
  to: "",
  pick: "from",
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
        : "Location Loc Prestige"
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
    .map((v) => {
      const status = vehicleStatus(v);
      return `
      <article class="card${v.photoFit === "contain" ? " photo-contain" : ""}" data-open="${v.id}" data-reveal>
        <div class="media">
          <img src="${v.image}" alt="${v.name}" loading="lazy" draggable="false" />
          <p class="status-badge${status.kind === "out" ? " is-out" : status.kind === "reserved" ? " is-busy" : ""}">${status.badge}</p>
          ${priceBadge(v)}
        </div>
        <div class="body">
          <p class="tag">${labels[v.category]}</p>
          <h3>${v.name}</h3>
          <p class="meta">${v.seats} places · ${v.transmission} · ${v.fuel}${v.power ? ` · ${v.power}` : ""}</p>
          <p class="meta">${status.label}</p>
          <p class="more">Découvrir</p>
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
  const free = statuses.filter((s) => s.kind === "free").length;
  if (countEl) {
    countEl.textContent = state.from && state.to
      ? `${free} disponible${free > 1 ? "s" : ""} · ${out + reserved} indisponible${out + reserved > 1 ? "s" : ""}`
      : `${VEHICLES.length} véhicules · ${out} en location · ${reserved} réservé${reserved > 1 ? "s" : ""}`;
  }
  const heroFleet = document.getElementById("heroFleet");
  if (heroFleet) {
    heroFleet.textContent = `${VEHICLES.length} véhicule${VEHICLES.length > 1 ? "s" : ""}`;
  }
}

function dateLabel(value) {
  return formatLong(value) || "Ajouter une date";
}

function syncDateInputs() {
  if (els.dateFrom) els.dateFrom.value = state.from;
  if (els.dateTo) els.dateTo.value = state.to;
  if (els.dateFromText) els.dateFromText.textContent = dateLabel(state.from);
  if (els.dateToText) els.dateToText.textContent = dateLabel(state.to);
  if (els.modalFromText) els.modalFromText.textContent = dateLabel(state.from);
  if (els.modalToText) els.modalToText.textContent = dateLabel(state.to);
  [els.dateFromBtn, els.modalFromBtn].forEach((btn) => btn?.classList.toggle("is-on", state.pick === "from"));
  [els.dateToBtn, els.modalToBtn].forEach((btn) => btn?.classList.toggle("is-on", state.pick === "to"));
}

function setDates(from, to) {
  state.from = from || "";
  state.to = to && from && to < from ? from : to || "";
  syncDateInputs();
  renderFleet();
  renderCount();
  if (state.vehicleId) refreshModalBooking();
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
    const picked = value === state.from || value === state.to;
    const inRange = state.from && state.to && value > state.from && value < state.to;
    const isToday = value === iso(new Date());
    const cls = [
      past || booked ? "is-muted" : "",
      booked ? "is-booked" : "",
      picked ? "is-picked" : "",
      inRange ? "is-range" : "",
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
  if (els.dateBook) els.dateBook.hidden = true;
  if (els.datebar) els.datebar.classList.remove("is-open");
}

function pickDay(value) {
  if (state.pick === "to" && state.from && value >= state.from) {
    setDates(state.from, value);
    state.pick = "from";
    syncDateInputs();
    return;
  }
  if (!state.from || (state.from && state.to) || value < state.from) {
    setDates(value, "");
    state.pick = "to";
    syncDateInputs();
    return;
  }
  setDates(state.from, value);
  state.pick = "from";
  syncDateInputs();
}

function refreshModalBooking() {
  const v = currentVehicle();
  if (!v) return;
  const status = vehicleStatus(v);
  const statusEl = document.getElementById("modalStatus");
  statusEl.textContent = status.label;
  statusEl.classList.toggle("is-out", status.kind === "out");
  statusEl.classList.toggle("is-busy", status.kind === "reserved");
  const conflict = state.from && state.to && rangeBusy(v, state.from, state.to);
  els.bookNote.textContent = conflict
    ? "Ces dates sont déjà prises. Choisissez un autre créneau."
    : state.from && state.to
      ? `Demande pour ${formatLong(state.from)} → ${formatLong(state.to)}.`
      : "Sélectionnez une prise en charge, puis un retour.";
  els.bookNote.classList.toggle("is-busy", conflict);
  const box = els.modal.querySelector(".contact-box");
  if (box) box.classList.toggle("is-disabled", conflict);
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
  if (day) pickDay(day.dataset.day);
});

els.datebar.addEventListener("click", (e) => {
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
  if (day) pickDay(day.dataset.day);
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
  if (els.datebar.contains(e.target)) return;
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
const FILE_KEYS = ["permis_recto", "permis_verso", "piece_recto", "piece_verso"];

function isAdult(value) {
  const birth = parseDay(value);
  const today = parseDay(iso(new Date()));
  if (!birth || !today) return false;
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 18;
}

function passportSelected() {
  return els.bookingForm?.elements.type_piece.value === "Passeport";
}

function syncIdBack() {
  const wrap = document.getElementById("bookingIdBack");
  const input = els.bookingForm?.elements.piece_verso;
  if (!wrap || !input) return;
  const hide = passportSelected();
  wrap.hidden = hide;
  input.required = !hide;
  if (hide) {
    input.value = "";
    wrap.classList.remove("has-file");
    const name = wrap.querySelector("[data-file-name]");
    if (name) name.textContent = "Ajouter une photo";
  }
}

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

function resetBooking() {
  if (!els.bookingForm) return;
  els.bookingForm.reset();
  els.bookingForm.querySelectorAll(".file-field").forEach((field) => {
    field.classList.remove("has-file");
    const name = field.querySelector("[data-file-name]");
    if (name) name.textContent = "Ajouter une photo";
  });
  if (els.bookingError) els.bookingError.textContent = "";
  document.getElementById("bookingFormWrap").hidden = false;
  document.getElementById("bookingDone").hidden = true;
  const submit = document.getElementById("bookingSubmit");
  if (submit) {
    submit.disabled = false;
    submit.textContent = "Envoyer la demande";
  }
  syncIdBack();
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
    const today = iso(new Date());
    els.bookingForm.elements.date_naissance.max = today;
    els.bookingForm.elements.permis_date.max = today;
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
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("type");
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

function missingRequired() {
  const form = els.bookingForm;
  const need = [
    "genre",
    "nom",
    "prenom",
    "date_naissance",
    "telephone",
    "email",
    "adresse",
    "code_postal",
    "ville",
    "permis_numero",
    "permis_date",
    "type_piece",
    "piece_numero",
  ];
  if (need.some((name) => !String(form.elements[name].value || "").trim())) return true;
  if (!form.elements.vehicule.value) return true;
  if (!form.elements.consentement.checked) return true;
  if (!form.elements.permis_recto.files[0] || !form.elements.permis_verso.files[0] || !form.elements.piece_recto.files[0]) {
    return true;
  }
  if (!passportSelected() && !form.elements.piece_verso.files[0]) return true;
  return false;
}

function bookingMailto(v, form) {
  const subject = encodeURIComponent(`Demande de location — ${v.name} — ${formatLong(state.from)} au ${formatLong(state.to)}`);
  const body = encodeURIComponent(
    `Demande de location Loc Prestige\n\n` +
      `Véhicule : ${v.name}\n` +
      `Prise en charge : ${formatLong(state.from)}\n` +
      `Retour : ${formatLong(state.to)}\n\n` +
      `Genre : ${form.elements.genre.value}\n` +
      `Nom : ${form.elements.nom.value.trim()}\n` +
      `Prénom : ${form.elements.prenom.value.trim()}\n` +
      `Date de naissance : ${form.elements.date_naissance.value}\n` +
      `Téléphone : ${form.elements.telephone.value.trim()}\n` +
      `E-mail : ${form.elements.email.value.trim()}\n` +
      `Adresse : ${form.elements.adresse.value.trim()}\n` +
      `Code postal : ${form.elements.code_postal.value.trim()}\n` +
      `Ville : ${form.elements.ville.value.trim()}\n\n` +
      `N° de permis : ${form.elements.permis_numero.value.trim()}\n` +
      `Date d’obtention : ${form.elements.permis_date.value}\n` +
      `Pièce : ${form.elements.type_piece.value} ${form.elements.piece_numero.value.trim()}\n\n` +
      `Message : ${form.elements.message.value.trim() || "—"}\n\n` +
      `Les photos du permis et de la pièce d’identité sont à joindre à cet e-mail.\n`
  );
  return `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
}

function showBookingDone() {
  document.getElementById("bookingFormWrap").hidden = true;
  document.getElementById("bookingDone").hidden = false;
}

async function submitBooking(e) {
  e.preventDefault();
  const form = els.bookingForm;
  els.bookingError.textContent = "";
  if (form.elements._honey.value) {
    showBookingDone();
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
    els.bookingError.textContent = "Choisissez un véhicule.";
    return;
  }
  if (rangeBusy(v, state.from, state.to)) {
    els.bookingError.textContent = "Ces dates sont déjà prises. Choisissez un autre créneau.";
    return;
  }
  if (missingRequired()) {
    els.bookingError.textContent = "Remplissez toutes les informations et ajoutez les photos du permis et de la pièce d’identité.";
    return;
  }
  if (!isAdult(form.elements.date_naissance.value)) {
    els.bookingError.textContent = "Le conducteur doit avoir au moins 18 ans.";
    return;
  }
  const submit = document.getElementById("bookingSubmit");
  submit.disabled = true;
  submit.textContent = "Envoi…";
  try {
    const data = new FormData();
    data.append("_subject", `Demande de location — ${v.name} — ${formatLong(state.from)} au ${formatLong(state.to)}`);
    data.append("_template", "table");
    data.append("_captcha", "false");
    data.append("_replyto", form.elements.email.value.trim());
    data.append("Vehicule", v.name);
    data.append("Prise_en_charge", formatLong(state.from));
    data.append("Retour", formatLong(state.to));
    data.append("Genre", form.elements.genre.value);
    data.append("Nom", form.elements.nom.value.trim());
    data.append("Prenom", form.elements.prenom.value.trim());
    data.append("Date_de_naissance", form.elements.date_naissance.value);
    data.append("Telephone", form.elements.telephone.value.trim());
    data.append("Email", form.elements.email.value.trim());
    data.append("Adresse", form.elements.adresse.value.trim());
    data.append("Code_postal", form.elements.code_postal.value.trim());
    data.append("Ville", form.elements.ville.value.trim());
    data.append("Permis_numero", form.elements.permis_numero.value.trim());
    data.append("Permis_date", form.elements.permis_date.value);
    data.append("Type_de_piece", form.elements.type_piece.value);
    data.append("Piece_numero", form.elements.piece_numero.value.trim());
    data.append("Message", form.elements.message.value.trim() || "—");
    for (const key of FILE_KEYS) {
      const file = form.elements[key].files[0];
      if (!file) {
        if (key === "piece_verso" && passportSelected()) continue;
        throw new Error("files");
      }
      if (file.size > FILE_MAX) throw new Error("size");
      const ready = await compressImage(file);
      data.append(key, ready, ready.name);
    }
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT.email)}`, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });
    const json = await res.json().catch(() => ({}));
    const ok = res.ok || json.success === true || json.success === "true";
    if (!ok) throw new Error("send");
    showBookingDone();
  } catch (err) {
    window.location.href = bookingMailto(v, form);
    els.bookingError.textContent =
      "L’envoi automatique n’a pas abouti. Votre messagerie s’ouvre : joignez-y les photos du permis et de la pièce d’identité.";
  } finally {
    submit.disabled = false;
    submit.textContent = "Envoyer la demande";
  }
}

els.bookingForm?.querySelectorAll("input[type=file]").forEach((input) => {
  input.addEventListener("change", () => {
    const field = input.closest(".file-field");
    const file = input.files[0];
    const name = field?.querySelector("[data-file-name]");
    if (name) name.textContent = file ? file.name : "Ajouter une photo";
    field?.classList.toggle("has-file", Boolean(file));
    if (file && file.size > FILE_MAX) {
      input.value = "";
      if (name) name.textContent = "Fichier trop lourd (8 Mo max)";
      field?.classList.remove("has-file");
    }
  });
});

els.bookingForm?.elements.vehicule?.addEventListener("change", () => {
  els.bookingForm.elements.vehicule_id.value = els.bookingForm.elements.vehicule.value;
  fillBookingRecap();
});

els.bookingForm?.elements.type_piece?.addEventListener("change", syncIdBack);
els.bookingForm?.addEventListener("submit", submitBooking);
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

syncDateInputs();
fillContacts();
renderFilters();
renderFleet();
renderCount();
renderTicker();

observeReveals();

function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) loader.classList.add("is-done");
}

window.setTimeout(hideLoader, 900);
