// Configuración inicial por defecto (Migrada desde data2.js original)
const APP_VERSION = "2.4";
const GITHUB_REPO = "aivorra/facilitator";
const DEFAULT_DOMAIN = ".local";

const DEFAULT_TIPOS = [
    { id: 'application', nombre: 'Application', color: '#77cd77' },
    { id: 'server', nombre: 'Server', color: '#a76ce5' },
    { id: 'networking', nombre: 'Networking', color: '#1b5e20' },
    { id: 'base_station', nombre: 'Base Station', color: '#0056b3' }
];

const COLOR_PRESETS = [
    '#77cd77', '#a76ce5', '#1b5e20', '#0056b3',
    '#e11d48', '#f59e0b', '#06b6d4', '#6366f1',
    '#ec4899', '#64748b'
];

const defaultHostsData = [
];

const defaultNotas = [
];

// Estado Global
let state = {
    hosts: [],
    notas: [],
    domain: DEFAULT_DOMAIN,
    darkMode: false,
    tipos: []
};


let selectedHost = null;
let selectedService = null;
let editMode = false;

// Utilidades
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

function getContrastColor(hexColor) {
    if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? '#1a202c' : '#ffffff';
}

function applyDynamicTipoStyles() {
    let styleTag = document.getElementById('dynamic-tipo-styles');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-tipo-styles';
        document.head.appendChild(styleTag);
    }
    let css = '';
    (state.tipos || []).forEach(t => {
        const safeClass = 'cat-' + t.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const textColor = getContrastColor(t.color);
        css += `.${safeClass} { background-color: ${t.color} !important; color: ${textColor} !important; }\n`;
    });
    styleTag.textContent = css;
}

// LocalStorage Logic
function loadData() {
    const dataStr = localStorage.getItem('facilitatorData');
    if (dataStr) {
        try {
            state = JSON.parse(dataStr);
            if (state.darkMode === undefined) state.darkMode = false;

            // Migrate to specific services per host
            if (!state.migratedToPerHostServices) {

                state.hosts.forEach(h => {
                    if (!h.servicios) h.servicios = [];
                    // Merge old global services
                    if (state.services && state.services[h.tipo]) {
                        state.services[h.tipo].forEach(s => {
                            if (!h.servicios.find(xs => xs.nombre === s.nombre && xs.puerto === s.puerto)) {
                                h.servicios.push({ ...s });
                            }
                        });
                    }
                    if (h.customServiceName && h.customServicePort) {
                        if (!h.servicios.find(xs => xs.nombre === h.customServiceName && xs.puerto === h.customServicePort)) {
                            h.servicios.push({ id: 'c_' + Date.now() + Math.random(), nombre: h.customServiceName, puerto: h.customServicePort, protocolo: (h.customServicePort === '80' ? 'http' : 'https') });
                        }
                        delete h.customServiceName;
                        delete h.customServicePort;
                    }
                });
                delete state.services;
                state.migratedToPerHostServices = true;
                saveData();
            }

            if (!state.migratedToNetworks) {
                const defaultRedId = 'red_default_' + Date.now();
                state.redes = [
                    { id: defaultRedId, nombre: 'Red Local', domain: state.domain || DEFAULT_DOMAIN }
                ];
                state.activeRedId = defaultRedId;

                if (state.hosts) {
                    state.hosts.forEach(h => h.redId = defaultRedId);
                }
                if (state.notas) {
                    state.notas.forEach(n => n.redId = defaultRedId);
                }

                state.migratedToNetworks = true;
                saveData();
            }
            if (!state.activeRedId && state.redes && state.redes.length > 0) {
                state.activeRedId = state.redes[0].id;
                saveData();
            }

            if (!state.notas || state.notas.length === 0) {
                state.notas = JSON.parse(JSON.stringify(defaultNotas));
                saveData();
            }

            // Migración para tipos configurables
            if (!state.tipos || state.tipos.length === 0) {
                state.tipos = JSON.parse(JSON.stringify(DEFAULT_TIPOS));
                if (state.hosts) {
                    state.hosts.forEach(h => {
                        if (h.tipo === 'service') {
                            h.tipo = 'application';
                        } else if (h.tipo && !state.tipos.some(t => t.id === h.tipo)) {
                            state.tipos.push({
                                id: h.tipo,
                                nombre: h.tipo.charAt(0).toUpperCase() + h.tipo.slice(1).replace(/_/g, ' '),
                                color: '#6c757d'
                            });
                        }
                    });
                }
                state.migratedToCustomTypes = true;
                saveData();
            } else {
                let modified = false;
                if (state.hosts) {
                    state.hosts.forEach(h => {
                        if (h.tipo === 'service') {
                            h.tipo = 'application';
                            modified = true;
                        } else if (h.tipo && !state.tipos.some(t => t.id === h.tipo)) {
                            state.tipos.push({
                                id: h.tipo,
                                nombre: h.tipo.charAt(0).toUpperCase() + h.tipo.slice(1).replace(/_/g, ' '),
                                color: '#6c757d'
                            });
                            modified = true;
                        }
                    });
                }
                if (modified) saveData();
            }

            applyDynamicTipoStyles();

        } catch (e) {
            console.error("Error validando datos locales", e);
            initDefaultData();
        }
    } else {
        initDefaultData();
    }
}

function initDefaultData() {
    const defaultRedId = 'red_default_' + Date.now();
    state.hosts = JSON.parse(JSON.stringify(defaultHostsData));
    state.notas = JSON.parse(JSON.stringify(defaultNotas));
    state.domain = DEFAULT_DOMAIN;
    state.darkMode = false;
    state.redes = [{ id: defaultRedId, nombre: 'Red Local', domain: DEFAULT_DOMAIN }];
    state.activeRedId = defaultRedId;
    state.tipos = JSON.parse(JSON.stringify(DEFAULT_TIPOS));
    state.migratedToNetworks = true;
    state.migratedToPerHostServices = true;
    state.migratedToCustomTypes = true;
    saveData();
    applyDynamicTipoStyles();
}

function saveData() {
    localStorage.setItem('facilitatorData', JSON.stringify(state));
}

// UI Render Logic
let draggedNotaIndex = null;

function renderNotas() {
    const container = document.getElementById('notas-container');
    container.innerHTML = "";

    const filteredNotas = state.notas.filter(n => n.redId === state.activeRedId);
    filteredNotas.forEach((nota, idx) => {
        const index = state.notas.indexOf(nota);
        const div = document.createElement('div');
        div.className = 'card-nota';
        if (editMode) div.setAttribute('draggable', 'true');

        div.innerHTML = `
            <div class="drag-handle"><i data-lucide="grip-vertical" class="icon-sm"></i></div>
            <div class="nota-content">${nota.texto}</div>
            <div class="nota-actions">
                <button class="btn-action edit-only" onclick="editarNota('${nota.id}')" title="Editar"><i data-lucide="pencil" class="icon-sm"></i></button>
                <button class="btn-action delete edit-only" onclick="borrarNota('${nota.id}')" title="Eliminar"><i data-lucide="trash-2" class="icon-sm"></i></button>
            </div>
        `;

        if (editMode) {
            div.addEventListener('dragstart', (e) => {
                draggedNotaIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => div.classList.add('dragging'), 0);
            });
            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
                draggedNotaIndex = null;
                renderNotas(); // reset all visual states
            });
            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            div.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedNotaIndex !== null && index !== draggedNotaIndex) {
                    // Small visual indicator of where it will drop
                    div.style.borderTop = "3px dashed var(--primary)";
                }
            });
            div.addEventListener('dragleave', (e) => {
                div.style.borderTop = "";
            });
            div.addEventListener('drop', (e) => {
                e.preventDefault();
                div.style.borderTop = "";
                if (draggedNotaIndex !== null && draggedNotaIndex !== index) {
                    // Reorder
                    const item = state.notas.splice(draggedNotaIndex, 1)[0];
                    state.notas.splice(index, 0, item);
                    saveData();
                    renderNotas();
                }
            });
        }

        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

let draggedHostIndex = null;
let draggedColumnTipoId = null;
let autoScrollTimer = null;

function startAutoScroll(direction) {
    if (autoScrollTimer) return;
    const container = document.getElementById('hosts-container');
    if (!container) return;
    autoScrollTimer = setInterval(() => {
        container.scrollLeft += direction * 20;
        updateColNavButtons();
    }, 30);
}

function stopAutoScroll() {
    if (autoScrollTimer) {
        clearInterval(autoScrollTimer);
        autoScrollTimer = null;
    }
}

function updateColNavButtons() {
    const container = document.getElementById('hosts-container');
    const prevBtn = document.getElementById('btn-col-prev');
    const nextBtn = document.getElementById('btn-col-next');
    if (!container || !prevBtn || !nextBtn) return;

    prevBtn.disabled = container.scrollLeft <= 5;
    const maxScroll = container.scrollWidth - container.clientWidth;
    nextBtn.disabled = container.scrollLeft >= maxScroll - 5;
}

function renderHosts(filtro = "") {
    const container = document.getElementById('hosts-container');
    container.innerHTML = "";

    // Garantizar que state.tipos existe
    if (!state.tipos || state.tipos.length === 0) {
        state.tipos = JSON.parse(JSON.stringify(DEFAULT_TIPOS));
    }

    // Preparar columnas basadas en state.tipos
    const columns = {};
    state.tipos.forEach(t => {
        columns[t.id] = { id: t.id, title: t.nombre, color: t.color, elements: [] };
    });

    const q = filtro.toLowerCase();
    const filteredHosts = state.hosts.filter(h => {
        if (h.redId !== state.activeRedId) return false;
        if (!q) return true;
        if (h.nombre.toLowerCase().includes(q)) return true;
        if (h.ip && h.ip.toLowerCase().includes(q)) return true;
        if (h.servicios && h.servicios.some(s => s.nombre.toLowerCase().includes(q))) return true;
        return false;
    });

    filteredHosts.forEach(host => {
        let colKey = host.tipo;
        if (colKey === 'service') colKey = 'application';
        if (!columns[colKey]) {
            colKey = state.tipos[0] ? state.tipos[0].id : 'application';
        }

        const indexInGlobal = state.hosts.indexOf(host);
        const isSelected = selectedHost && selectedHost.id === host.id ? 'selected' : '';

        const div = document.createElement('div');
        div.className = 'item-wrapper';
        if (editMode && filtro === "") {
            div.setAttribute('draggable', 'true');
        }

        const safeCat = 'cat-' + (host.tipo || 'application').replace(/[^a-zA-Z0-9_-]/g, '_');
        div.innerHTML = `
            ${editMode && filtro === "" ? '<div class="drag-handle" style="display:flex; align-items:center; cursor:grab; color:var(--text-secondary);"><i data-lucide="grip-vertical" class="icon-sm"></i></div>' : ''}
            <button class="host-btn ${safeCat} ${isSelected}" onclick="seleccionarHost('${host.id}')" style="flex:1;">
                ${host.nombre}
            </button>
            <button class="btn-action edit-only" onclick="editarHost('${host.id}')" title="Editar"><i data-lucide="pencil" class="icon-sm"></i></button>
            <button class="btn-action delete edit-only" onclick="borrarHost('${host.id}')" title="Eliminar"><i data-lucide="trash-2" class="icon-sm"></i></button>
        `;

        if (editMode && filtro === "") {
            div.addEventListener('dragstart', (e) => {
                e.stopPropagation(); // Evitar disparar arrastre de la columna
                draggedHostIndex = indexInGlobal;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => div.classList.add('dragging'), 0);
            });
            div.addEventListener('dragend', (e) => {
                e.stopPropagation();
                div.classList.remove('dragging');
                draggedHostIndex = null;
                renderHosts(filtro);
            });
            div.addEventListener('dragover', (e) => {
                e.stopPropagation();
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            div.addEventListener('dragenter', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (draggedHostIndex !== null && indexInGlobal !== draggedHostIndex) {
                    div.style.borderTop = "3px dashed var(--primary)";
                }
            });
            div.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                div.style.borderTop = "";
            });
            div.addEventListener('drop', (e) => {
                e.stopPropagation();
                e.preventDefault();
                div.style.borderTop = "";
                if (draggedHostIndex !== null && draggedHostIndex !== indexInGlobal) {
                    const item = state.hosts.splice(draggedHostIndex, 1)[0];
                    let dropIndex = state.hosts.indexOf(host);
                    if (dropIndex === -1) dropIndex = state.hosts.length;

                    state.hosts.splice(dropIndex, 0, item);
                    saveData();
                    renderHosts(filtro);
                }
            });
        }

        columns[colKey].elements.push(div);
    });

    let visibleCols = 0;
    state.tipos.forEach(tipo => {
        const colData = columns[tipo.id];
        if (colData && colData.elements.length > 0) {
            visibleCols++;
            const colDiv = document.createElement('div');
            colDiv.className = 'column';
            colDiv.dataset.tipoId = tipo.id;

            const h3 = document.createElement('h3');
            h3.style.display = 'flex';
            h3.style.alignItems = 'center';
            h3.style.justifyContent = 'center';
            h3.style.gap = '8px';

            if (editMode && filtro === "") {
                colDiv.setAttribute('draggable', 'true');
                h3.innerHTML = `
                    <span class="col-drag-handle" title="Arrastrar columna para reordenar">
                        <i data-lucide="grip-vertical" class="icon-sm"></i>
                    </span>
                    <span style="flex:1; text-align:center;">${tipo.nombre}</span>
                `;

                colDiv.addEventListener('dragstart', (e) => {
                    draggedColumnTipoId = tipo.id;
                    e.dataTransfer.effectAllowed = 'move';
                    setTimeout(() => colDiv.classList.add('dragging-col'), 0);
                });

                colDiv.addEventListener('dragend', () => {
                    colDiv.classList.remove('dragging-col');
                    draggedColumnTipoId = null;
                    stopAutoScroll();
                    renderHosts(filtro);
                });

                colDiv.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';

                    const rect = container.getBoundingClientRect();
                    const edgeMargin = 70;
                    if (e.clientX < rect.left + edgeMargin) {
                        startAutoScroll(-1);
                    } else if (e.clientX > rect.right - edgeMargin) {
                        startAutoScroll(1);
                    } else {
                        stopAutoScroll();
                    }
                });

                colDiv.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (draggedColumnTipoId && draggedColumnTipoId !== tipo.id) {
                        colDiv.style.borderLeft = "4px dashed var(--primary)";
                    }
                });

                colDiv.addEventListener('dragleave', () => {
                    colDiv.style.borderLeft = "";
                });

                colDiv.addEventListener('drop', (e) => {
                    e.preventDefault();
                    colDiv.style.borderLeft = "";
                    stopAutoScroll();
                    if (draggedColumnTipoId && draggedColumnTipoId !== tipo.id) {
                        const fromIdx = state.tipos.findIndex(t => t.id === draggedColumnTipoId);
                        const toIdx = state.tipos.findIndex(t => t.id === tipo.id);
                        if (fromIdx > -1 && toIdx > -1) {
                            const moved = state.tipos.splice(fromIdx, 1)[0];
                            state.tipos.splice(toIdx, 0, moved);
                            saveData();
                            renderHosts(filtro);
                        }
                    }
                });

            } else {
                h3.innerHTML = `<span>${tipo.nombre}</span>`;
            }

            colDiv.appendChild(h3);

            const gridDiv = document.createElement('div');
            gridDiv.className = 'buttons-grid';
            colData.elements.forEach(el => gridDiv.appendChild(el));

            colDiv.appendChild(gridDiv);
            container.appendChild(colDiv);
        }
    });

    const prevBtn = document.getElementById('btn-col-prev');
    const nextBtn = document.getElementById('btn-col-next');

    if (visibleCols > 5) {
        container.classList.add('has-many-cols');
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
        updateColNavButtons();
    } else {
        container.classList.remove('has-many-cols');
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }

    if (window.lucide) lucide.createIcons();
}

function renderServices() {
    const section = document.getElementById('modal-services-selection');
    const container = document.getElementById('services-list');
    const titleSpan = document.getElementById('selected-host-name');

    if (!selectedHost) {
        section.classList.remove('active');
        return;
    }

    titleSpan.textContent = selectedHost.nombre;
    container.innerHTML = "";

    const services = selectedHost.servicios || [];

    if (services.length === 0) {
        container.innerHTML = "<p style='color: gray; font-size: 13px;'>No hay servicios configurados.</p>";
    }

    services.forEach(srv => {
        const isSelected = selectedService && selectedService.id === srv.id ? 'selected' : '';
        const safeCat = 'cat-' + (selectedHost.tipo || 'application').replace(/[^a-zA-Z0-9_-]/g, '_');
        const srvHtml = `
            <div class="item-wrapper">
                <button class="service-btn ${safeCat} ${isSelected}" onclick="seleccionarService('${srv.id}')">
                    ${srv.nombre} (${srv.puerto})
                </button>
            </div>
        `;
        container.innerHTML += srvHtml;
    });
    if (window.lucide) lucide.createIcons();
}

window.seleccionarService = function (srvId) {
    if (!selectedHost) return;
    const services = selectedHost.servicios || [];
    selectedService = services.find(s => s.id === srvId);
    actualizarUrl();
    renderServices();
    if (!editMode) {
        closeModal('modal-services-selection');
    }
};

// Interaction Logic
window.seleccionarHost = function (hostId) {
    selectedHost = state.hosts.find(h => h.id === hostId);
    selectedService = null;

    if (selectedHost) {
        const services = selectedHost.servicios || [];
        if (services.length === 1) {
            selectedService = services[0];
        }
    }

    actualizarUrl();
    renderHosts(document.getElementById('buscador').value);

    if (selectedHost) {
        const services = selectedHost.servicios || [];
        if (services.length !== 1) {
            renderServices();
            document.getElementById('modal-services-selection').classList.add('active');
        } else {
            // Also call renderServices in the background just in case
            renderServices();
        }
    } else {
        renderServices();
    }
};

function actualizarUrl() {
    const input = document.getElementById('url-display');
    const btn = document.getElementById('btn-open-url');

    if (!selectedHost || !selectedService) {
        input.value = "";
        btn.disabled = true;
        return;
    }

    let hostFull = selectedHost.ip;
    let useDomain = selectedHost.usarDominio !== undefined ? selectedHost.usarDominio : !/^\d{1,3}(\.\d{1,3}){3}$/.test(selectedHost.ip);
    const currentRed = state.redes ? state.redes.find(r => r.id === selectedHost.redId) : null;

    if (useDomain && currentRed && currentRed.domain) {
        hostFull += currentRed.domain;
    }

    const prot = selectedService.protocolo || 'https';
    let url;
    if (prot === 'file') {
        url = `file://${hostFull}`;
    } else {
        let portPart = `:${selectedService.puerto}`;
        if ((prot === 'http' && selectedService.puerto === '80') || (prot === 'https' && selectedService.puerto === '443')) {
            portPart = '';
        }
        url = `${prot}://${hostFull}${portPart}`;
    }

    input.value = url;
    btn.disabled = false;
    btn.onclick = () => window.open(url, "_blank");
}

document.getElementById('buscador').addEventListener('input', (e) => {
    renderHosts(e.target.value);
});

document.getElementById('btn-clear-search').addEventListener('click', () => {
    document.getElementById('buscador').value = "";
    document.getElementById('url-display').value = "";
    selectedHost = null;
    selectedService = null;
    actualizarUrl();
    renderHosts();
    renderServices();
});

// Edit Mode Toggle
document.getElementById('btn-toggle-edit').addEventListener('click', () => {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    document.getElementById('btn-toggle-edit').innerHTML = editMode ? '<i data-lucide="save" class="icon-sm"></i>' : '<i data-lucide="pencil" class="icon-sm"></i>';
    document.getElementById('btn-toggle-edit').title = editMode ? 'Salir Edición' : 'Modo Edición';
    document.getElementById('btn-toggle-edit').classList.toggle('btn-primary', editMode);
    document.getElementById('btn-toggle-edit').classList.toggle('btn-secondary', !editMode);

    // Toggle notes button
    document.getElementById('btn-add-nota').style.display = editMode ? 'inline-flex' : 'none';

    // Re-render to update drag handles and icons
    renderNotas();
    renderHosts(document.getElementById('buscador') ? document.getElementById('buscador').value : "");
    if (window.lucide) lucide.createIcons();
});

// Modal Logic
window.closeModal = function (id) {
    document.getElementById(id).classList.remove('active');
}

window.addHostServiceRow = function (nombre = '', puerto = '', protocolo = 'https') {
    const container = document.getElementById('host-services-container');
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.marginBottom = '10px';
    row.className = 'host-service-row';
    row.innerHTML = `
        <input type="text" class="svc-name" placeholder="Nombre (Ej: Web)" value="${nombre}" style="flex:1;">
        <input type="number" class="svc-port" placeholder="Puerto" value="${puerto}" style="width:100px;">
        <select class="svc-prot" style="width:90px">
            <option value="https" ${protocolo === 'https' ? 'selected' : ''}>HTTPS</option>
            <option value="http" ${protocolo === 'http' ? 'selected' : ''}>HTTP</option>
            <option value="file" ${protocolo === 'file' ? 'selected' : ''}>FILE</option>
        </select>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i data-lucide="trash-2" class="icon-sm"></i></button>
    `;
    container.appendChild(row);
    if (window.lucide) lucide.createIcons();
}

function populateHostTypeSelect() {
    const select = document.getElementById('host-type');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '';
    (state.tipos || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.nombre;
        select.appendChild(opt);
    });
    if (currentVal && state.tipos.some(t => t.id === currentVal)) {
        select.value = currentVal;
    } else if (state.tipos && state.tipos.length > 0) {
        select.value = state.tipos[0].id;
    }
}

// Hosts CRUD
document.getElementById('btn-add-host').addEventListener('click', () => {
    populateHostTypeSelect();
    document.getElementById('form-host').reset();
    document.getElementById('host-id').value = "";
    document.getElementById('host-use-domain').checked = false;
    document.getElementById('host-red').value = state.activeRedId;
    document.getElementById('host-services-container').innerHTML = '';
    window.addHostServiceRow('WEB', '443', 'https');
    document.getElementById('modal-host-title').textContent = "Añadir Host";
    document.getElementById('modal-host').classList.add('active');
});

window.editarHost = function (hostId) {
    const host = state.hosts.find(h => h.id === hostId);
    if (!host) return;

    document.getElementById('host-id').value = host.id;
    document.getElementById('host-name').value = host.nombre;
    document.getElementById('host-ip').value = host.ip;
    document.getElementById('host-red').value = host.redId || state.activeRedId;
    document.getElementById('host-use-domain').checked = host.usarDominio !== undefined ? host.usarDominio : !/^\d{1,3}(\.\d{1,3}){3}$/.test(host.ip);

    document.getElementById('host-services-container').innerHTML = '';
    if (host.servicios && host.servicios.length > 0) {
        host.servicios.forEach(s => window.addHostServiceRow(s.nombre, s.puerto, s.protocolo));
    } else {
        window.addHostServiceRow('WEB', '443', 'https');
    }

    populateHostTypeSelect();
    let select = document.getElementById('host-type');
    let exists = Array.from(select.options).some(o => o.value === host.tipo);
    if (!exists) {
        let opt = document.createElement('option');
        opt.value = host.tipo;
        opt.textContent = host.tipo + ' (Personalizado)';
        select.appendChild(opt);
    }
    select.value = host.tipo;

    document.getElementById('modal-host-title').textContent = "Editar Host";
    document.getElementById('modal-host').classList.add('active');
};

window.borrarHost = function (hostId) {
    if (confirm('¿Estás seguro de que quieres borrar este host?')) {
        state.hosts = state.hosts.filter(h => h.id !== hostId);
        if (selectedHost && selectedHost.id === hostId) {
            selectedHost = null;
            selectedService = null;
        }
        saveData();
        renderHosts();
        renderServices();
        actualizarUrl();
    }
}

document.getElementById('form-host').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('host-id').value;

    const servicios = [];
    document.querySelectorAll('.host-service-row').forEach(row => {
        const nombre = row.querySelector('.svc-name').value.trim();
        const puerto = row.querySelector('.svc-port').value.trim();
        const protocolo = row.querySelector('.svc-prot').value.trim();
        if (nombre && puerto) {
            servicios.push({ id: 's_' + Date.now() + Math.random(), nombre, puerto, protocolo });
        }
    });

    const data = {
        nombre: document.getElementById('host-name').value,
        ip: document.getElementById('host-ip').value,
        tipo: document.getElementById('host-type').value,
        usarDominio: document.getElementById('host-use-domain').checked,
        redId: document.getElementById('host-red').value,
        servicios: servicios
    };

    if (id) {
        const index = state.hosts.findIndex(h => h.id === id);
        if (index > -1) {
            state.hosts[index] = { ...state.hosts[index], ...data };
            if (selectedHost && selectedHost.id === id) selectedHost = state.hosts[index];
        }
    } else {
        state.hosts.push({ id: generateId(), ...data });
    }

    saveData();
    closeModal('modal-host');
    renderHosts();
    if (selectedHost) {
        renderServices();
        actualizarUrl();
    }
});

// Notas CRUD
document.getElementById('btn-add-nota').addEventListener('click', () => {
    document.getElementById('form-nota').reset();
    document.getElementById('nota-id').value = "";
    document.getElementById('nota-red').value = state.activeRedId;
    document.getElementById('modal-nota-title').textContent = "Añadir Nota";
    document.getElementById('modal-nota').classList.add('active');
});

window.editarNota = function (id) {
    const nota = state.notas.find(n => n.id === id);
    if (!nota) return;
    document.getElementById('nota-id').value = nota.id;
    document.getElementById('nota-texto').value = nota.texto;
    document.getElementById('nota-red').value = nota.redId || state.activeRedId;
    document.getElementById('modal-nota-title').textContent = "Editar Nota";
    document.getElementById('modal-nota').classList.add('active');
}

window.borrarNota = function (id) {
    if (confirm('¿Estás seguro de eliminar esta nota?')) {
        state.notas = state.notas.filter(n => n.id !== id);
        saveData();
        renderNotas();
    }
}

document.getElementById('form-nota').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('nota-id').value;
    const txt = document.getElementById('nota-texto').value.trim();
    if (!txt) return;
    const redId = document.getElementById('nota-red').value;

    if (id) {
        const index = state.notas.findIndex(n => n.id === id);
        if (index > -1) {
            state.notas[index].texto = txt;
            state.notas[index].redId = redId;
        }
    } else {
        state.notas.push({ id: 'n_' + Date.now() + Math.random(), texto: txt, redId });
    }

    saveData();
    closeModal('modal-nota');
    renderNotas();
});

// Import / Export
document.getElementById('btn-export').addEventListener('click', () => {
    const container = document.getElementById('export-networks-container');
    container.innerHTML = '';
    if (!state.redes || state.redes.length === 0) {
        alert("No hay redes para exportar.");
        return;
    }

    state.redes.forEach(red => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '8px';
        label.style.cursor = 'pointer';
        label.style.padding = '5px 0';
        label.innerHTML = `
            <input type="checkbox" class="export-network-checkbox" value="${red.id}" checked>
            <span>${red.nombre} <small style="color:gray;">${red.domain ? '(' + red.domain + ')' : ''}</small></span>
        `;
        container.appendChild(label);
    });

    document.getElementById('modal-export').classList.add('active');
});

document.getElementById('form-export')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedCheckboxes = Array.from(document.querySelectorAll('.export-network-checkbox:checked'));
    if (selectedCheckboxes.length === 0) {
        alert("Debes seleccionar al menos una red para exportar.");
        return;
    }

    const selectedNetworkIds = selectedCheckboxes.map(cb => cb.value);

    // Generar estado parcial filtrado
    const selectedRedes = state.redes.filter(r => selectedNetworkIds.includes(r.id));
    const selectedHosts = state.hosts.filter(h => selectedNetworkIds.includes(h.redId));
    const selectedNotas = state.notas.filter(n => selectedNetworkIds.includes(n.redId));

    // Crear objeto de exportación conservando configuraciones globales si las hay
    const exportData = {
        ...state,
        activeRedId: selectedNetworkIds.length > 0 ? selectedNetworkIds[0] : state.activeRedId,
        redes: selectedRedes,
        hosts: selectedHosts,
        notas: selectedNotas
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Construir nombre de archivo
    const networkNames = selectedRedes.map(r => r.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase()).join('-');
    const filenamePrefix = networkNames.length > 50 ? networkNames.substring(0, 50) + '_' : networkNames + '_';

    a.download = `facilitator_${filenamePrefix}config_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    closeModal('modal-export');
});

document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData.hosts) {
                state = importedData;

                // Si el archivo importado es de la versión antigua, no tendrá el flag de migración.
                // Forzamos loadData para que corra la migración en caso de ser necesario.
                if (!state.migratedToPerHostServices) {
                    saveData(); // Guardamos temporalmente
                    loadData(); // Esto ejecutará la migración y actualizará la UI 
                } else {
                    saveData();
                }

                selectedHost = null;
                selectedService = null;
                actualizarUrl();
                applyDynamicTipoStyles();
                populateNetworkSelects();
                populateHostTypeSelect();
                renderActiveNetworkSelect();
                updateHeaderDomain();
                renderHosts();
                renderNotas();
                renderServices();
                alert('Configuración importada exitosamente.');
            } else {
                alert('El archivo no parece tener el formato correcto.');
            }
        } catch (err) {
            alert('Error leyendo el archivo JSON: ' + err.message);
        }
        e.target.value = ""; // reset input
    };
    reader.readAsText(file);
});

// Settings
document.getElementById('btn-settings').addEventListener('click', () => {
    switchSettingsTab('redes');
    document.getElementById('modal-settings').classList.add('active');
});

function updateHeaderDomain() {
    const display = document.getElementById('header-domain-display');
    const currentRed = state.redes ? state.redes.find(r => r.id === state.activeRedId) : null;
    if (currentRed && currentRed.domain && currentRed.domain.trim() !== '') {
        display.textContent = `- ${currentRed.domain}`;
        document.title = `${currentRed.domain} - Facilitator`;
    } else {
        display.textContent = '';
        document.title = 'Facilitator';
    }
}

// Column navigation arrows
const colContainer = document.getElementById('hosts-container');
colContainer?.addEventListener('scroll', updateColNavButtons);

document.getElementById('btn-col-prev')?.addEventListener('click', () => {
    const col = colContainer.querySelector('.column');
    const step = col ? col.offsetWidth + 20 : 250;
    colContainer.scrollBy({ left: -step, behavior: 'smooth' });
});

document.getElementById('btn-col-next')?.addEventListener('click', () => {
    const col = colContainer.querySelector('.column');
    const step = col ? col.offsetWidth + 20 : 250;
    colContainer.scrollBy({ left: step, behavior: 'smooth' });
});

document.getElementById('btn-col-prev')?.addEventListener('dragover', (e) => {
    e.preventDefault();
    startAutoScroll(-1);
});
document.getElementById('btn-col-prev')?.addEventListener('dragleave', stopAutoScroll);

document.getElementById('btn-col-next')?.addEventListener('dragover', (e) => {
    e.preventDefault();
    startAutoScroll(1);
});
document.getElementById('btn-col-next')?.addEventListener('dragleave', stopAutoScroll);

// Theme Setup
function applyTheme() {
    if (state.darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('btn-theme-toggle').innerHTML = '<i data-lucide="sun" class="icon-sm"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('btn-theme-toggle').innerHTML = '<i data-lucide="moon" class="icon-sm"></i>';
    }
    if (window.lucide) lucide.createIcons();
}

document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    saveData();
    applyTheme();
});

// INIT
loadData();
applyTheme();
populateNetworkSelects();
populateHostTypeSelect();
renderActiveNetworkSelect();
updateHeaderDomain();
renderHosts();
renderNotas();

// Inyectar versión en el footer
const footerVersion = document.getElementById('footer-version');
if (footerVersion) footerVersion.textContent = `Versión ${APP_VERSION} | Agustin Ivorra`;



function renderNetworks() {
    const container = document.getElementById('networks-container');
    if (!container) return;
    container.innerHTML = '';

    if (!state.redes) state.redes = [];

    state.redes.forEach(red => {
        const div = document.createElement('div');
        div.className = 'item-wrapper';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '10px';
        div.style.border = '1px solid var(--border-color)';
        div.style.borderRadius = '4px';
        div.style.background = 'var(--bg-secondary)';

        div.innerHTML = `
            <div>
                <strong style="display:block;">${red.nombre}</strong>
                <small style="color:gray;">${red.domain ? 'Dominio: ' + red.domain : 'Sin Dominio'}</small>
            </div>
            <div style="display:flex; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="editNetwork('${red.id}')"><i data-lucide="pencil" class="icon-sm"></i></button>
                <button type="button" class="btn btn-danger btn-sm" onclick="promptDeleteNetwork('${red.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

window.switchSettingsTab = function (tabName) {
    const isNetworks = tabName === 'redes';
    const btnNet = document.getElementById('btn-tab-networks');
    const btnTip = document.getElementById('btn-tab-types');
    const tabNet = document.getElementById('tab-networks');
    const tabTip = document.getElementById('tab-types');

    if (btnNet) btnNet.classList.toggle('active', isNetworks);
    if (btnTip) btnTip.classList.toggle('active', !isNetworks);
    if (tabNet) tabNet.style.display = isNetworks ? 'block' : 'none';
    if (tabTip) tabTip.style.display = isNetworks ? 'none' : 'block';

    if (isNetworks) {
        renderNetworks();
    } else {
        renderTipos();
    }
    if (window.lucide) lucide.createIcons();
};

let draggedTipoSettingIndex = null;

function renderTipos() {
    const container = document.getElementById('tipos-container');
    if (!container) return;
    container.innerHTML = '';

    if (!state.tipos) state.tipos = [];

    state.tipos.forEach((tipo, index) => {
        const card = document.createElement('div');
        card.className = 'tipo-item-card';
        card.setAttribute('draggable', 'true');

        const hostCount = (state.hosts || []).filter(h => h.tipo === tipo.id).length;

        card.innerHTML = `
            <div class="tipo-info">
                <div class="drag-handle" style="cursor:grab; display:flex; align-items:center; color:var(--secondary);" title="Arrastrar para reordenar"><i data-lucide="grip-vertical" class="icon-sm"></i></div>
                <div class="tipo-color-badge" style="background-color: ${tipo.color};"></div>
                <div>
                    <strong style="display:block; font-size:14px;">${tipo.nombre}</strong>
                    <small style="color:gray;">${tipo.color} • ${hostCount} host${hostCount === 1 ? '' : 's'}</small>
                </div>
            </div>
            <div class="tipo-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="moveTipo(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Subir"><i data-lucide="chevron-up" class="icon-sm"></i></button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="moveTipo(${index}, 1)" ${index === state.tipos.length - 1 ? 'disabled' : ''} title="Bajar"><i data-lucide="chevron-down" class="icon-sm"></i></button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="openTipoForm('${tipo.id}')" title="Editar"><i data-lucide="pencil" class="icon-sm"></i></button>
                <button type="button" class="btn btn-danger btn-sm" onclick="borrarTipo('${tipo.id}')" title="Eliminar"><i data-lucide="trash-2" class="icon-sm"></i></button>
            </div>
        `;

        card.addEventListener('dragstart', (e) => {
            draggedTipoSettingIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => card.classList.add('dragging'), 0);
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedTipoSettingIndex = null;
            renderTipos();
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        card.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (draggedTipoSettingIndex !== null && index !== draggedTipoSettingIndex) {
                card.style.borderTop = "3px dashed var(--primary)";
            }
        });
        card.addEventListener('dragleave', () => {
            card.style.borderTop = "";
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.style.borderTop = "";
            if (draggedTipoSettingIndex !== null && draggedTipoSettingIndex !== index) {
                const item = state.tipos.splice(draggedTipoSettingIndex, 1)[0];
                state.tipos.splice(index, 0, item);
                saveData();
                renderTipos();
                renderHosts();
                populateHostTypeSelect();
            }
        });

        container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

window.moveTipo = function (index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.tipos.length) return;
    const item = state.tipos.splice(index, 1)[0];
    state.tipos.splice(newIndex, 0, item);
    saveData();
    renderTipos();
    renderHosts();
    populateHostTypeSelect();
};

window.openTipoForm = function (id = null) {
    const form = document.getElementById('form-tipo');
    form.reset();
    initColorPresets();

    if (id) {
        const tipo = state.tipos.find(t => t.id === id);
        if (!tipo) return;
        document.getElementById('tipo-id').value = tipo.id;
        document.getElementById('tipo-name').value = tipo.nombre;
        document.getElementById('tipo-color').value = tipo.color;
        document.getElementById('tipo-color-hex').value = tipo.color;
        document.getElementById('modal-tipo-title').textContent = 'Editar Tipo';
    } else {
        document.getElementById('tipo-id').value = '';
        document.getElementById('tipo-color').value = '#007bff';
        document.getElementById('tipo-color-hex').value = '#007bff';
        document.getElementById('modal-tipo-title').textContent = 'Añadir Tipo';
    }

    document.getElementById('modal-tipo-form').classList.add('active');
};

function initColorPresets() {
    const container = document.getElementById('tipo-color-presets');
    if (!container) return;
    container.innerHTML = '';
    COLOR_PRESETS.forEach(hex => {
        const dot = document.createElement('div');
        dot.className = 'color-preset-dot';
        dot.style.backgroundColor = hex;
        dot.title = hex;
        dot.onclick = () => {
            document.getElementById('tipo-color').value = hex;
            document.getElementById('tipo-color-hex').value = hex;
        };
        container.appendChild(dot);
    });
}

document.getElementById('tipo-color')?.addEventListener('input', (e) => {
    document.getElementById('tipo-color-hex').value = e.target.value.toLowerCase();
});

document.getElementById('tipo-color-hex')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        document.getElementById('tipo-color').value = val;
    }
});

document.getElementById('form-tipo')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('tipo-id').value;
    const nombre = document.getElementById('tipo-name').value.trim();
    let color = document.getElementById('tipo-color-hex').value.trim().toLowerCase();

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        color = document.getElementById('tipo-color').value;
    }

    if (!nombre) return;

    if (id) {
        const tipo = state.tipos.find(t => t.id === id);
        if (tipo) {
            tipo.nombre = nombre;
            tipo.color = color;
        }
    } else {
        const newId = 'tipo_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        state.tipos.push({ id: newId, nombre, color });
    }

    saveData();
    applyDynamicTipoStyles();
    populateHostTypeSelect();
    closeModal('modal-tipo-form');
    renderTipos();
    renderHosts();
    if (selectedHost) {
        renderServices();
    }
});

window.borrarTipo = function (id) {
    if (state.tipos.length <= 1) {
        alert("Debe haber al menos un tipo de host configurado.");
        return;
    }

    const tipoToDelete = state.tipos.find(t => t.id === id);
    if (!tipoToDelete) return;

    const affectedHosts = (state.hosts || []).filter(h => h.tipo === id);
    const fallbackTipo = state.tipos.find(t => t.id !== id);

    if (affectedHosts.length > 0) {
        const confirmMsg = `Hay ${affectedHosts.length} host(s) asignados al tipo "${tipoToDelete.nombre}".\n\nSi eliminas este tipo, estos hosts pasarán automáticamente al tipo "${fallbackTipo.nombre}".\n\n¿Deseas continuar?`;
        if (!confirm(confirmMsg)) return;
        affectedHosts.forEach(h => h.tipo = fallbackTipo.id);
    } else {
        if (!confirm(`¿Estás seguro de eliminar el tipo "${tipoToDelete.nombre}"?`)) return;
    }

    state.tipos = state.tipos.filter(t => t.id !== id);
    saveData();
    applyDynamicTipoStyles();
    populateHostTypeSelect();
    renderTipos();
    renderHosts();
    if (selectedHost) renderServices();
};

window.openNetworkForm = function () {
    document.getElementById('form-network').reset();
    document.getElementById('network-id').value = '';
    document.getElementById('modal-network-title').textContent = 'Añadir Red';
    document.getElementById('modal-network-form').classList.add('active');
};

window.editNetwork = function (id) {
    const red = state.redes.find(r => r.id === id);
    if (!red) return;
    document.getElementById('network-id').value = red.id;
    document.getElementById('network-name').value = red.nombre;
    document.getElementById('network-domain').value = red.domain || '';
    document.getElementById('modal-network-title').textContent = 'Editar Red';
    document.getElementById('modal-network-form').classList.add('active');
};

let currentDeleteNetworkId = null;

window.promptDeleteNetwork = function (id) {
    const red = state.redes.find(r => r.id === id);
    if (!red) return;

    // Validar si es la única red
    if (state.redes.length <= 1) {
        alert("No puedes eliminar la única red existente. Por favor, crea una nueva red primero.");
        return;
    }

    currentDeleteNetworkId = red.id;
    document.getElementById('delete-network-name-display').textContent = red.nombre;
    document.getElementById('delete-network-name-expected').value = red.nombre;
    document.getElementById('delete-network-confirm').value = '';
    document.getElementById('btn-confirm-delete').disabled = true;

    document.getElementById('modal-delete-network').classList.add('active');
};

document.getElementById('delete-network-confirm')?.addEventListener('input', (e) => {
    const expected = document.getElementById('delete-network-name-expected').value;
    document.getElementById('btn-confirm-delete').disabled = (e.target.value !== expected);
});

document.getElementById('form-delete-network')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentDeleteNetworkId) return;

    const expected = document.getElementById('delete-network-name-expected').value;
    const confirms = document.getElementById('delete-network-confirm').value;

    if (expected !== confirms) return;

    // Ejecutar el borrado en cascada
    state.redes = state.redes.filter(r => r.id !== currentDeleteNetworkId);
    state.hosts = state.hosts.filter(h => h.redId !== currentDeleteNetworkId);
    state.notas = state.notas.filter(n => n.redId !== currentDeleteNetworkId);

    // Si borramos la red activa actual, pivotamos a otra.
    if (state.activeRedId === currentDeleteNetworkId) {
        state.activeRedId = state.redes[0].id;
        selectedHost = null;
        selectedService = null;
    }

    currentDeleteNetworkId = null;
    saveData();
    closeModal('modal-delete-network');
    renderNetworks();
    populateNetworkSelects();
    renderActiveNetworkSelect();
    applyActiveNetworkState();
});

document.getElementById('form-network')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('network-id').value;
    const nombre = document.getElementById('network-name').value.trim();
    const domain = document.getElementById('network-domain').value.trim();

    if (!nombre) return;

    if (id) {
        const index = state.redes.findIndex(r => r.id === id);
        if (index > -1) {
            state.redes[index].nombre = nombre;
            state.redes[index].domain = domain;
        }
    } else {
        const newRed = { id: 'red_' + Date.now(), nombre, domain };
        state.redes.push(newRed);
    }

    saveData();
    closeModal('modal-network-form');
    renderNetworks();
    populateNetworkSelects();
    renderActiveNetworkSelect();
    applyActiveNetworkState();
});

function renderActiveNetworkSelect() {
    const select = document.getElementById('active-network-select');
    if (!select) return;
    select.innerHTML = '';

    if (!state.redes) return;

    state.redes.forEach(red => {
        const opt = document.createElement('option');
        opt.value = red.id;
        opt.textContent = red.nombre;
        if (red.id === state.activeRedId) opt.selected = true;
        select.appendChild(opt);
    });
}

function populateNetworkSelects() {
    ['host-red', 'nota-red'].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        state.redes.forEach((red, idx) => {
            const opt = document.createElement('option');
            opt.value = red.id;
            opt.textContent = red.nombre;
            // Si hay un valor, mantenlo. Si no, selecciona la red activa por defecto.
            if ((currentVal && currentVal === red.id) || (!currentVal && state.activeRedId === red.id)) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    });
}

document.getElementById('active-network-select')?.addEventListener('change', (e) => {
    state.activeRedId = e.target.value;
    selectedHost = null;
    selectedService = null;
    saveData();
    applyActiveNetworkState();
});

function applyActiveNetworkState() {
    actualizarUrl();
    updateHeaderDomain();
    renderHosts(document.getElementById('buscador').value);
    renderNotas();
    if (selectedHost) {
        renderServices();
    } else {
        document.getElementById('modal-services-selection').classList.remove('active');
    }
}

// ── Update Check ─────────────────────────────────────────────────────────────
function parseVersion(v) {
    // Elimina prefijos como "v" o "release" (ej: "v2.3", "release2.4" → [2,4])
    return String(v).replace(/^[^\d]*/, '').split('.').map(Number);
}

function isNewer(remote, local) {
    const r = parseVersion(remote);
    const l = parseVersion(local);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] ?? 0;
        const lv = l[i] ?? 0;
        if (rv > lv) return true;
        if (rv < lv) return false;
    }
    return false;
}

async function checkForUpdates() {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
            { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        const remoteTag = data.tag_name || '';
        if (!remoteTag || !isNewer(remoteTag, APP_VERSION)) return;

        // Mostrar banner de actualización debajo del texto de versión
        const footerP = document.querySelector('.app-footer p');
        if (!footerP) return;
        const footerEl = footerP.parentElement;

        const banner = document.createElement('a');
        banner.id = 'update-banner';
        banner.href = data.html_url;
        banner.target = '_blank';
        banner.rel = 'noopener noreferrer';
        banner.title = `Ver ${remoteTag} en GitHub`;
        banner.innerHTML = `<i data-lucide="arrow-up-circle" class="icon-sm" style="vertical-align:middle;"></i>&nbsp;Nueva versión disponible: ${remoteTag}`;
        banner.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:5px',
            'padding:3px 10px',
            'border-radius:20px',
            'font-size:12px',
            'font-weight:600',
            'text-decoration:none',
            'color:#fff',
            'background:linear-gradient(135deg,#3b82f6,#6366f1)',
            'box-shadow:0 2px 8px rgba(99,102,241,0.4)',
            'animation:pulse-badge 2s ease-in-out infinite'
        ].join(';');

        footerEl.insertBefore(banner, footerP);
        if (window.lucide) lucide.createIcons();
    } catch (_) {
        // Falla en silencio — sin conexión o repo no existente
    }
}

// Inyectar keyframe de pulso
(function injectUpdateStyles() {
    if (document.getElementById('update-check-styles')) return;
    const style = document.createElement('style');
    style.id = 'update-check-styles';
    style.textContent = `
        @keyframes pulse-badge {
            0%, 100% { box-shadow: 0 2px 8px rgba(99,102,241,0.4); }
            50%        { box-shadow: 0 2px 16px rgba(99,102,241,0.75); }
        }
    `;
    document.head.appendChild(style);
})();

checkForUpdates();
