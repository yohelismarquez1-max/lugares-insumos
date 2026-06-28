const placesList = document.querySelector("#placesList");
const placeForm = document.querySelector("#placeForm");
const formMessage = document.querySelector("#formMessage");
const searchInput = document.querySelector("#searchInput");
const entityFilter = document.querySelector("#entityFilter");
const localityFilter = document.querySelector("#localityFilter");
const entitySelect = document.querySelector("#entitySelect");
const localitySelect = document.querySelector("#localitySelect");
const urgencyFilter = document.querySelector("#urgencyFilter");
const statusFilter = document.querySelector("#statusFilter");
const totalPlaces = document.querySelector("#totalPlaces");
const urgentPlaces = document.querySelector("#urgentPlaces");
const coveredPlaces = document.querySelector("#coveredPlaces");
const visibleCount = document.querySelector("#visibleCount");
const highCount = document.querySelector("#highCount");
const mediumCount = document.querySelector("#mediumCount");
const lowCount = document.querySelector("#lowCount");
const googleMapFrame = document.querySelector("#googleMapFrame");
const mapStatus = document.querySelector("#mapStatus");
const stateChips = document.querySelector("#stateChips");
const localityTitle = document.querySelector("#localityTitle");
const localityChips = document.querySelector("#localityChips");
const startedAtInput = document.querySelector("#startedAt");

let places = [];
let selectedPlaceId = "";
let activeEntity = "";

const supabaseConfig = window.SUPABASE_CONFIG || {};
const hasSupabaseConfig =
  supabaseConfig.SUPABASE_URL &&
  supabaseConfig.SUPABASE_ANON_KEY &&
  !supabaseConfig.SUPABASE_URL.includes("PEGA_AQUI") &&
  !supabaseConfig.SUPABASE_ANON_KEY.includes("PEGA_AQUI");

const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(supabaseConfig.SUPABASE_URL, supabaseConfig.SUPABASE_ANON_KEY)
  : null;

function fromSupabase(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    entity: row.entity,
    contact: row.contact,
    urgency: row.urgency,
    status: row.status,
    supplies: Array.isArray(row.supplies) ? row.supplies : [],
    notes: row.notes || "",
    createdAt: row.created_at
  };
}

function toSupabase(payload) {
  return {
    name: String(payload.name || "").trim(),
    address: String(payload.address || "").trim(),
    city: String(payload.city || "").trim(),
    entity: String(payload.entity || "").trim(),
    contact: String(payload.contact || "").trim(),
    urgency: String(payload.urgency || "media").trim(),
    status: String(payload.status || "necesita").trim(),
    supplies: String(payload.supplies || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    notes: String(payload.notes || "").trim()
  };
}

function validatePayload(payload) {
  const errors = [];
  if (!payload.name) errors.push("Indica el nombre del lugar.");
  if (!payload.address) errors.push("Indica la dirección.");
  if (!payload.entity) errors.push("Selecciona un estado.");
  if (!payload.city) errors.push("Selecciona una localidad.");
  if (!payload.contact) errors.push("Indica un contacto.");
  if (payload.supplies.length === 0) errors.push("Indica al menos un insumo.");
  if (!["alta", "media", "baja"].includes(payload.urgency)) errors.push("Selecciona una urgencia válida.");
  if (!["necesita", "parcial", "cubierto"].includes(payload.status)) errors.push("Selecciona una situación válida.");
  return errors;
}


const VENEZUELA_ENTITIES = [
  "Amazonas",
  "Anzoategui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolivar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Dependencias Federales",
  "Distrito Capital",
  "Falcon",
  "Guarico",
  "La Guaira",
  "Lara",
  "Merida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Tachira",
  "Trujillo",
  "Yaracuy",
  "Zulia"
];

const LOCALITIES = {
  Amazonas: ["Puerto Ayacucho", "San Fernando de Atabapo", "Maroa"],
  Anzoategui: ["Barcelona", "Puerto La Cruz", "El Tigre", "Anaco"],
  Apure: ["San Fernando de Apure", "Guasdualito", "Elorza", "Achaguas"],
  Aragua: ["Maracay", "Turmero", "La Victoria", "Cagua"],
  Barinas: ["Barinas", "Socopo", "Sabaneta", "Barinitas"],
  Bolivar: ["Ciudad Bolivar", "Puerto Ordaz", "Ciudad Guayana", "Upata", "Santa Elena de Uairen"],
  Carabobo: ["Valencia", "Puerto Cabello", "Guacara", "Naguanagua"],
  Cojedes: ["San Carlos", "Tinaquillo", "El Baul"],
  "Delta Amacuro": ["Tucupita", "Pedernales", "Curiapo"],
  "Dependencias Federales": ["Los Roques", "Isla La Tortuga", "La Orchila"],
  "Distrito Capital": ["Caracas", "El Valle", "Catia", "La Pastora"],
  Falcon: ["Coro", "Punto Fijo", "Chichiriviche", "Tucacas"],
  Guarico: ["San Juan de los Morros", "Calabozo", "Valle de la Pascua", "Zaraza"],
  "La Guaira": ["La Guaira", "Maiquetia", "Catia La Mar", "Caraballeda"],
  Lara: ["Barquisimeto", "Cabudare", "Carora", "El Tocuyo"],
  Merida: ["Merida", "El Vigia", "Tovar", "Ejido"],
  Miranda: ["Los Teques", "Guarenas", "Guatire", "Petare", "Charallave"],
  Monagas: ["Maturin", "Punta de Mata", "Temblador"],
  "Nueva Esparta": ["Porlamar", "La Asuncion", "Juan Griego", "Pampatar"],
  Portuguesa: ["Guanare", "Acarigua", "Araure", "Turen"],
  Sucre: ["Cumana", "Carupano", "Guiria", "Cariaco"],
  Tachira: ["San Cristobal", "Rubio", "La Grita", "San Antonio del Tachira"],
  Trujillo: ["Trujillo", "Valera", "Bocono", "Pampanito"],
  Yaracuy: ["San Felipe", "Yaritagua", "Chivacoa", "Nirgua"],
  Zulia: ["Maracaibo", "Cabimas", "Ciudad Ojeda", "Machiques"]
};

function populateEntityOptions() {
  const options = VENEZUELA_ENTITIES.map((entity) => `<option value="${entity}">${entity}</option>`).join("");
  entityFilter.insertAdjacentHTML("beforeend", options);
  entitySelect.insertAdjacentHTML("beforeend", options);
}

function renderStateChips() {
  stateChips.innerHTML = VENEZUELA_ENTITIES.map((entity) => {
    const activeClass = entity === activeEntity ? " is-active" : "";
    return `<button type="button" class="${activeClass}" data-entity="${entity}">${entity}</button>`;
  }).join("");
}

function populateLocalitySelect(select, entity, emptyLabel) {
  const localities = LOCALITIES[entity] || [];
  select.innerHTML = `<option value="">${emptyLabel}</option>${localities
    .map((locality) => `<option value="${locality}">${locality}</option>`)
    .join("")}`;
  select.disabled = localities.length === 0;
}

function populateLocalities(entity) {
  populateLocalitySelect(localityFilter, entity, "Todas");
  populateLocalitySelect(localitySelect, entity, "Selecciona una localidad");
  renderLocalityChips(entity);
}

function renderLocalityChips(entity) {
  const localities = LOCALITIES[entity] || [];
  localityTitle.textContent = entity ? `Localidades de ${entity}` : "Localidades";
  if (!entity) {
    localityChips.innerHTML = '<span class="locality-empty">Selecciona un estado para ver sus localidades.</span>';
    return;
  }

  localityChips.innerHTML = localities
    .map((locality) => `<button type="button" data-locality="${escapeHtml(locality)}">${escapeHtml(locality)}</button>`)
    .join("");
}

function formatLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function mapQueryForPlace(place) {
  return `${place.address}, ${place.city}, ${place.entity}, Venezuela`;
}

function updateRealMap(query) {
  const safeQuery = query?.trim() || "Venezuela";
  googleMapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(safeQuery)}&output=embed`;
}

function placeMatchesFilters(place) {
  const query = searchInput.value.trim().toLowerCase();
  const searchable = [
    place.name,
    place.address,
    place.city,
    place.entity,
    place.contact,
    place.notes,
    ...place.supplies
  ]
    .join(" ")
    .toLowerCase();

  return (
    (!query || searchable.includes(query)) &&
    (!entityFilter.value || place.entity === entityFilter.value) &&
    (!localityFilter.value || place.city === localityFilter.value) &&
    (!urgencyFilter.value || place.urgency === urgencyFilter.value) &&
    (!statusFilter.value || place.status === statusFilter.value)
  );
}

function getCounts() {
  return places.reduce(
    (counts, place) => {
      if (counts[place.urgency] !== undefined) counts[place.urgency] += 1;
      if (place.status === "cubierto") counts.covered += 1;
      return counts;
    },
    { alta: 0, media: 0, baja: 0, covered: 0 }
  );
}

function renderStats() {
  const counts = getCounts();
  totalPlaces.textContent = String(places.length);
  urgentPlaces.textContent = String(counts.alta);
  coveredPlaces.textContent = String(counts.covered);
  highCount.textContent = String(counts.alta);
  mediumCount.textContent = String(counts.media);
  lowCount.textContent = String(counts.baja);
}

function updateSelectedStyles() {
  document.querySelectorAll("[data-card-id]").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.cardId === selectedPlaceId);
  });
  document.querySelectorAll("[data-entity]").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.entity === activeEntity);
  });
  document.querySelectorAll("[data-locality]").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.locality === localityFilter.value);
  });
}

function updateMapStatus() {
  const place = places.find((item) => item.id === selectedPlaceId);
  if (place) {
    mapStatus.innerHTML = `
      <strong>${escapeHtml(place.name)}</strong>
      <span>${escapeHtml(place.city)}, ${escapeHtml(place.entity)}</span>
    `;
    updateRealMap(mapQueryForPlace(place));
    return;
  }

  if (localityFilter.value && activeEntity) {
    mapStatus.innerHTML = `<strong>${escapeHtml(localityFilter.value)}</strong><span>${escapeHtml(activeEntity)}, Venezuela</span>`;
    updateRealMap(`${localityFilter.value}, ${activeEntity}, Venezuela`);
    return;
  }

  if (activeEntity) {
    mapStatus.innerHTML = `<strong>${escapeHtml(activeEntity)}</strong><span>Elige una localidad para afinar la busqueda.</span>`;
    updateRealMap(`${activeEntity}, Venezuela`);
    return;
  }

  mapStatus.textContent = "Mapa real de Venezuela";
  updateRealMap("Venezuela");
}

function selectPlace(placeId, scrollToMap = false) {
  selectedPlaceId = placeId;
  const place = places.find((item) => item.id === placeId);
  if (place) {
    activeEntity = place.entity || activeEntity;
    entityFilter.value = activeEntity;
    entitySelect.value = activeEntity;
    populateLocalities(activeEntity);
    localityFilter.value = place.city || "";
    localitySelect.value = place.city || "";
  }
  updateSelectedStyles();
  updateMapStatus();

  if (scrollToMap) {
    document.querySelector("#venezuelaMap").scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function selectEntity(entity) {
  activeEntity = entity;
  selectedPlaceId = "";
  entityFilter.value = entity;
  entitySelect.value = entity;
  localityFilter.value = "";
  populateLocalities(entity);
  renderStateChips();
  renderPlaces();
}

function selectLocality(locality) {
  if (!activeEntity) return;
  selectedPlaceId = "";
  localityFilter.value = locality;
  localitySelect.value = locality;
  renderPlaces();
}

function mapsUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQueryForPlace(place))}`;
}

function renderPlaces() {
  const filtered = places.filter(placeMatchesFilters);
  renderStats();

  if (filtered.length > 0 && !filtered.some((place) => place.id === selectedPlaceId)) {
    selectedPlaceId = filtered[0].id;
  }
  if (filtered.length === 0) {
    selectedPlaceId = "";
  }

  const currentPlace = filtered.find((place) => place.id === selectedPlaceId);
  if (currentPlace && !activeEntity) {
    activeEntity = currentPlace.entity;
    entitySelect.value = activeEntity;
    populateLocalities(activeEntity);
    localitySelect.value = currentPlace.city || "";
  }

  renderStateChips();
  updateMapStatus();
  updateSelectedStyles();
  visibleCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    placesList.innerHTML = '<div class="empty-state">No hay lugares que coincidan con los filtros.</div>';
    return;
  }

  placesList.innerHTML = filtered
    .map((place) => {
      const selectedClass = place.id === selectedPlaceId ? " is-selected" : "";
      return `
        <article class="place-card priority-${place.urgency}${selectedClass}" data-card-id="${escapeHtml(place.id)}">
          <div class="card-top">
            <div>
              <h3>${escapeHtml(place.name)}</h3>
              <p class="address">${escapeHtml(place.address)} - ${escapeHtml(place.city)}, ${escapeHtml(place.entity)}</p>
            </div>
            <div class="badges">
              <span class="badge urgency-${place.urgency}">${formatLabel(place.urgency)}</span>
              <span class="badge status-${place.status}">${formatLabel(place.status)}</span>
            </div>
          </div>
          <div class="supplies">
            ${place.supplies.map((item) => `<span class="supply">${escapeHtml(item)}</span>`).join("")}
          </div>
          ${place.notes ? `<p class="notes">${escapeHtml(place.notes)}</p>` : ""}
          <div class="meta">
            <span>Contacto: ${escapeHtml(place.contact)}</span>
            <span>Publicado: ${formatDate(place.createdAt)}</span>
          </div>
          <div class="card-actions">
            <button class="copy-button" type="button" data-focus-map="${escapeHtml(place.id)}">Ver en mapa</button>
            <a class="secondary-action" href="${mapsUrl(place)}" target="_blank" rel="noopener">Abrir en Maps</a>
            <button class="copy-button" type="button" data-copy-contact="${escapeHtml(place.contact)}">Copiar contacto</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetFormTimer() {
  if (startedAtInput) startedAtInput.value = String(Date.now());
}

async function loadPlaces() {
  if (!supabaseClient) {
    throw new Error("Faltan las claves de Supabase en public/config.js");
  }

  const { data, error } = await supabaseClient
    .from("places")
    .select("id,name,address,city,entity,contact,urgency,status,supplies,notes,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  places = data.map(fromSupabase);
  renderPlaces();
}

async function submitPlace(event) {
  event.preventDefault();
  formMessage.classList.remove("is-error");

  if (!supabaseClient) {
    formMessage.classList.add("is-error");
    formMessage.textContent = "Faltan las claves de Supabase en public/config.js.";
    return;
  }

  formMessage.textContent = "Guardando publicacion...";

  const formData = new FormData(placeForm);
  const payload = toSupabase(Object.fromEntries(formData.entries()));
  const errors = validatePayload(payload);

  if (errors.length > 0) {
    formMessage.classList.add("is-error");
    formMessage.textContent = errors.join(" ");
    return;
  }

  const { data, error } = await supabaseClient
    .from("places")
    .insert(payload)
    .select("id,name,address,city,entity,contact,urgency,status,supplies,notes,created_at")
    .single();

  if (error) {
    formMessage.classList.add("is-error");
    formMessage.textContent = error.message || "No se pudo publicar.";
    return;
  }

  const result = fromSupabase(data);
  placeForm.reset();
  resetFormTimer();
  activeEntity = result.entity;
  entityFilter.value = activeEntity;
  entitySelect.value = activeEntity;
  populateLocalities(activeEntity);
  localityFilter.value = result.city;
  localitySelect.value = result.city;
  places.unshift(result);
  selectedPlaceId = result.id;
  formMessage.textContent = "Publicado correctamente.";
  renderPlaces();
  document.querySelector("#listTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handlePlaceActions(event) {
  const focusButton = event.target.closest("[data-focus-map]");
  if (focusButton) {
    selectPlace(focusButton.dataset.focusMap, true);
    return;
  }

  const copyButton = event.target.closest("[data-copy-contact]");
  if (!copyButton) return;

  try {
    await navigator.clipboard.writeText(copyButton.dataset.copyContact);
    const original = copyButton.textContent;
    copyButton.textContent = "Contacto copiado";
    setTimeout(() => {
      copyButton.textContent = original;
    }, 1600);
  } catch {
    formMessage.classList.add("is-error");
    formMessage.textContent = "No se pudo copiar el contacto.";
  }
}

function handleEntityFilterChange() {
  activeEntity = entityFilter.value;
  selectedPlaceId = "";
  entitySelect.value = activeEntity;
  localityFilter.value = "";
  populateLocalities(activeEntity);
  renderPlaces();
}

function handleEntitySelectChange() {
  activeEntity = entitySelect.value;
  selectedPlaceId = "";
  entityFilter.value = activeEntity;
  localityFilter.value = "";
  populateLocalities(activeEntity);
  renderPlaces();
}

function handleLocalityFilterChange() {
  selectedPlaceId = "";
  localitySelect.value = localityFilter.value;
  renderPlaces();
}

function handleLocalitySelectChange() {
  selectedPlaceId = "";
  localityFilter.value = localitySelect.value;
  renderPlaces();
}

placeForm.addEventListener("submit", submitPlace);
placesList.addEventListener("click", handlePlaceActions);
stateChips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-entity]");
  if (button) selectEntity(button.dataset.entity);
});
localityChips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-locality]");
  if (button) selectLocality(button.dataset.locality);
});
searchInput.addEventListener("input", renderPlaces);
entityFilter.addEventListener("change", handleEntityFilterChange);
localityFilter.addEventListener("change", handleLocalityFilterChange);
entitySelect.addEventListener("change", handleEntitySelectChange);
localitySelect.addEventListener("change", handleLocalitySelectChange);
urgencyFilter.addEventListener("change", renderPlaces);
statusFilter.addEventListener("change", renderPlaces);

populateEntityOptions();
populateLocalities("");
renderStateChips();
resetFormTimer();
loadPlaces().catch(() => {
  placesList.innerHTML = '<div class="empty-state">No se pudieron cargar los lugares. Revisa public/config.js y la tabla de Supabase.</div>';
});
