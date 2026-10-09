(() => {
  'use strict';

  const STORAGE_KEY = 'walkout:v1';

  // ---------- State ----------
  const uid = () => Math.random().toString(36).slice(2, 10);
  const makeItem = (text) => ({ id: uid(), text });

  function defaultState() {
    const destinations = [
      { name: 'Class', items: ['Laptop and charger', 'Notebook and pens', 'Textbooks', 'Student ID', 'Water bottle'] },
      { name: 'Gym', items: ['Gym clothes', 'Sneakers', 'Headphones', 'Towel', 'Water bottle', 'Lock'] },
      { name: 'Library', items: ['Laptop and charger', 'Headphones', 'Notes', 'Student ID'] },
    ].map((d) => ({ id: uid(), name: d.name, items: d.items.map(makeItem) }));

    return {
      essentials: ['Keys', 'Wallet', 'Phone'].map(makeItem),
      destinations,
      activeId: destinations[0].id,
      checked: {},
    };
  }

  function isValid(s) {
    return (
      s &&
      Array.isArray(s.essentials) &&
      Array.isArray(s.destinations) &&
      s.destinations.length > 0 &&
      s.destinations.every((d) => d && typeof d.name === 'string' && Array.isArray(d.items)) &&
      s.checked && typeof s.checked === 'object'
    );
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) {
          if (!parsed.destinations.some((d) => d.id === parsed.activeId)) {
            parsed.activeId = parsed.destinations[0].id;
          }
          return parsed;
        }
      }
    } catch (err) {
      /* storage unavailable or corrupted: fall back to defaults */
    }
    return defaultState();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* storage unavailable: the app still works for this session */
    }
  }

  const state = load();
  let editing = false;
  let toastTimer = null;

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    destinations: $('destinations'),
    addDestination: $('add-destination'),
    newDestination: $('new-destination'),
    destName: $('dest-name'),
    destItemsHeading: $('dest-items-heading'),
    essentialsList: $('essentials-list'),
    destList: $('dest-list'),
    editToggle: $('edit-toggle'),
    deleteDestination: $('delete-destination'),
    status: $('status'),
    exitBtn: $('exit-btn'),
    toast: $('toast'),
    addForms: document.querySelectorAll('form.add-row[data-target]'),
  };

  const activeDestination = () => state.destinations.find((d) => d.id === state.activeId);

  // ---------- Rendering ----------
  function renderDestinations() {
    els.destinations.replaceChildren();
    state.destinations.forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = d.name;
      btn.setAttribute('aria-pressed', String(d.id === state.activeId));
      btn.addEventListener('click', () => {
        state.activeId = d.id;
        save();
        render();
      });
      els.destinations.appendChild(btn);
    });
  }

  function renderItems(listEl, items, onRemove, emptyMessage) {
    listEl.replaceChildren();

    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = emptyMessage;
      listEl.appendChild(li);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.dataset.id = item.id;

      if (editing) {
        const text = document.createElement('span');
        text.className = 'item-static';
        text.textContent = item.text;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', 'Remove ' + item.text);
        remove.addEventListener('click', () => onRemove(item.id));

        li.append(text, remove);
      } else {
        const label = document.createElement('label');
        label.className = 'item-label';

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = Boolean(state.checked[item.id]);
        box.addEventListener('change', () => {
          if (box.checked) state.checked[item.id] = true;
          else delete state.checked[item.id];
          li.classList.toggle('done', box.checked);
          save();
          renderStatus();
        });

        const text = document.createElement('span');
        text.className = 'item-text';
        text.textContent = item.text;

        label.append(box, text);
        li.appendChild(label);
        li.classList.toggle('done', box.checked);
      }

      listEl.appendChild(li);
    });
  }

  function renderStatus() {
    const dest = activeDestination();
    const all = [...state.essentials, ...dest.items];
    const left = all.filter((i) => !state.checked[i.id]).length;

    if (editing) {
      els.status.textContent = 'Editing lists';
      els.exitBtn.disabled = true;
    } else if (all.length === 0) {
      els.status.textContent = 'Add items to get started';
      els.exitBtn.disabled = true;
    } else if (left === 0) {
      els.status.textContent = 'Everything is packed';
      els.exitBtn.disabled = false;
    } else {
      els.status.textContent = left === 1 ? '1 item left to pack' : left + ' items left to pack';
      els.exitBtn.disabled = true;
    }
  }

  function render() {
    const dest = activeDestination();

    renderDestinations();
    els.destName.textContent = dest.name;
    els.destItemsHeading.textContent = 'For ' + dest.name;

    renderItems(
      els.essentialsList,
      state.essentials,
      (id) => removeItem(state.essentials, id),
      'No essentials yet. Choose Edit lists to add keys, your phone, or anything else you need every time.'
    );
    renderItems(
      els.destList,
      dest.items,
      (id) => removeItem(dest.items, id),
      'Nothing here yet. Choose Edit lists to add items for ' + dest.name + '.'
    );

    els.editToggle.setAttribute('aria-pressed', String(editing));
    els.editToggle.textContent = editing ? 'Done editing' : 'Edit lists';
    els.addDestination.hidden = !editing;
    els.addForms.forEach((f) => (f.hidden = !editing));
    els.deleteDestination.hidden = !(editing && state.destinations.length > 1);

    renderStatus();
  }

  // ---------- Actions ----------
  function addItem(list, text) {
    const clean = text.trim();
    if (!clean) return false;
    if (list.some((i) => i.text.toLowerCase() === clean.toLowerCase())) return false;
    list.push(makeItem(clean));
    save();
    render();
    return true;
  }

  function removeItem(list, id) {
    const index = list.findIndex((i) => i.id === id);
    if (index === -1) return;
    list.splice(index, 1);
    delete state.checked[id];
    save();
    render();
  }

  function showToast(message) {
    els.toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (els.toast.textContent = ''), 4000);
  }

  // ---------- Events ----------
  els.editToggle.addEventListener('click', () => {
    editing = !editing;
    render();
  });

  els.addForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const list = form.dataset.target === 'essentials' ? state.essentials : activeDestination().items;
      if (addItem(list, input.value)) {
        input.value = '';
        input.focus();
      } else if (input.value.trim()) {
        showToast('That item is already on this list.');
      }
    });
  });

  els.addDestination.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = els.newDestination.value.trim();
    if (!name) return;
    if (state.destinations.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      showToast('You already have a destination with that name.');
      return;
    }
    const dest = { id: uid(), name, items: [] };
    state.destinations.push(dest);
    state.activeId = dest.id;
    els.newDestination.value = '';
    save();
    render();
  });

  els.deleteDestination.addEventListener('click', () => {
    if (state.destinations.length <= 1) return;
    const dest = activeDestination();
    if (!window.confirm('Delete "' + dest.name + '" and its items?')) return;
    dest.items.forEach((i) => delete state.checked[i.id]);
    state.destinations = state.destinations.filter((d) => d.id !== dest.id);
    state.activeId = state.destinations[0].id;
    save();
    render();
  });

  els.exitBtn.addEventListener('click', () => {
    const dest = activeDestination();
    [...state.essentials, ...dest.items].forEach((i) => delete state.checked[i.id]);
    save();
    render();
    showToast('Have a good one at ' + dest.name + '. Your checks are cleared for next time.');
  });

  // ---------- Start ----------
  render();
})();
