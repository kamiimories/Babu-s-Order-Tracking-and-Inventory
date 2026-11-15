// -------------------------------------------------------------------------
    // 1. STATE MANAGEMENT & LOCAL STORAGE PERSISTENCE
    // -------------------------------------------------------------------------
    const STORAGE_KEY = 'babus_order_tracker_clean_v2';

    // Invoice banner images (embedded)
    const INVOICE_BANNER_TOP = "assets/order-request.jpg";
    const INVOICE_QR_CODE = "assets/qr-gcash.jpg";
    const INVOICE_THANKYOU = "assets/thank-you.jpg";

    const INVOICE_QR_GOTYME = "assets/qr-gotyme.jpg";
    const INVOICE_QR_MARIBANK = "assets/qr-maribank.jpg";

    let orders = [];
    let inventory = []; // { id, name, stock, price }
    let historyStack = [];
    let currentTab = 'ongoing';
    let paymentFilter = 'all';
    let activeReceiptOrder = null;

    // Load saved state cleanly (starts empty with 0 orders if nothing saved yet)
    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Migrate old format (just orders array)
            orders = parsed;
            inventory = [];
          } else {
            orders = Array.isArray(parsed.orders) ? parsed.orders : [];
            inventory = Array.isArray(parsed.inventory) ? parsed.inventory : [];
          }
        } else {
          // Try migrate from v1 key
          const oldRaw = localStorage.getItem('babus_order_tracker_clean_v1');
          if (oldRaw) {
            try {
              const oldParsed = JSON.parse(oldRaw);
              orders = Array.isArray(oldParsed) ? oldParsed : [];
            } catch (_) { orders = []; }
          } else {
            orders = [];
          }
          inventory = [];
          saveStateToStorage(false);
        }
      } catch (err) {
        console.error('Error reading localStorage:', err);
        orders = [];
        inventory = [];
      }
      updateUndoButton();
      renderTables();
      renderInventoryTable();
    }

    // Persist state immediately to localStorage and pulse the Auto-saved badge
    function saveStateToStorage(pulseBadge = true) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ orders, inventory }));
        if (pulseBadge) {
          triggerAutoSavePulse();
        }
      } catch (err) {
        console.error('Error saving to localStorage:', err);
        showToast('Storage warning: Please export a CSV backup!', 'peach');
      }
    }

    function triggerAutoSavePulse() {
      const badge = document.getElementById('autoSaveBadge');
      const text = document.getElementById('autoSaveText');
      if (!badge || !text) return;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      text.textContent = `Auto-saved (${timeStr}) ✓`;
      badge.classList.add('ring-2', 'ring-sage-400', 'bg-sage-200');

      setTimeout(() => {
        badge.classList.remove('ring-2', 'ring-sage-400', 'bg-sage-200');
      }, 900);
    }

    // Push deep clone snapshot to Undo stack before any mutating action
    function pushHistory(label = 'Change') {
      historyStack.push({
        label,
        snapshot: JSON.stringify({ orders, inventory })
      });
      if (historyStack.length > 35) {
        historyStack.shift();
      }
      updateUndoButton();
    }

    function handleUndo() {
      if (historyStack.length === 0) return;
      const previous = historyStack.pop();
      const snap = JSON.parse(previous.snapshot);
      orders = Array.isArray(snap.orders) ? snap.orders : (Array.isArray(snap) ? snap : []);
      inventory = Array.isArray(snap.inventory) ? snap.inventory : [];
      saveStateToStorage();
      updateUndoButton();
      renderTables();
      renderInventoryTable();
      showToast(`Undid: ${previous.label}`, 'lavender');
    }

    function updateUndoButton() {
      const btn = document.getElementById('undoBtn');
      const badge = document.getElementById('undoCountBadge');
      if (!btn || !badge) return;

      if (historyStack.length > 0) {
        btn.disabled = false;
        badge.textContent = historyStack.length;
        badge.classList.remove('hidden');
      } else {
        btn.disabled = true;
        badge.classList.add('hidden');
      }
    }

    // Optional sample data loader (only triggered if user explicitly clicks button)
    function loadDemoSamples() {
      pushHistory('Load sample orders');
      const today = getTodayDateStr();
      const samples = [
        {
          id: generateUUID(),
          orderNumber: generateUniqueOrderNumber(),
          fullName: 'Hana Takahashi',
          socmeds: [
            { platform: 'IG', handle: '@hanasketches' },
            { platform: 'X', handle: '@hana_art' }
          ],
          contact: '0917 884 2910',
          address: {
            houseStreet: 'Unit 4B Maple Residences, 128 Katipunan Ave',
            brgy: 'Loyola Heights',
            city: 'Quezon City',
            province: 'Metro Manila',
            zip: '1108'
          },
          items: [
            { name: 'Custom Chibi Couple Illustration (Digital + Print)', qty: 1, price: 1250 },
            { name: 'Holographic Starry Sticker Sheet', qty: 2, price: 150 }
          ],
          subtotal: 1550,
          shippingOption: 'J&T Express',
          shippingStatus: 'Preparing',
          paymentMethod: 'G-Cash',
          isPaid: true,
          stage: 'ongoing',
          shippingAmount: 0,
          shippedDate: '',
          shippingDetails: '',
          deliveredDate: '',
          createdAt: new Date().toISOString()
        },
        {
          id: generateUUID(),
          orderNumber: generateUniqueOrderNumber(),
          fullName: 'Marco Villareal',
          socmeds: [
            { platform: 'FB', handle: 'Marco Villareal' }
          ],
          contact: '0928 551 0432',
          address: {
            houseStreet: '45 Sampaguita St.',
            brgy: 'San Antonio',
            city: 'Makati City',
            province: 'Metro Manila',
            zip: '1203'
          },
          items: [
            { name: 'A4 Matte Art Print — "Sunset Over Kyoto"', qty: 2, price: 350 },
            { name: 'Acrylic Keychain — Cat Witch', qty: 1, price: 220 }
          ],
          subtotal: 920,
          shippingOption: 'Gogo Xpress',
          shippingStatus: 'In Transit',
          paymentMethod: 'GoTyme',
          isPaid: true,
          stage: 'shipping',
          shippingAmount: 85,
          shippedDate: today,
          shippingDetails: 'Gogo Xpress Tracking #GGX-9928410 — Packed with backing board',
          deliveredDate: '',
          createdAt: new Date().toISOString()
        }
      ];

      orders.push(...samples);
      saveStateToStorage();
      renderTables();
      showToast('2 sample orders added!', 'peach');
    }

    // -------------------------------------------------------------------------
    // 2. SEQUENTIAL ORDER NUMBER GENERATOR & HELPERS
    // -------------------------------------------------------------------------
    function generateUniqueOrderNumber() {
      // Sequential ascending: 000001, 000002, ...
      // Uses max existing numeric order # + 1 so mixed/imported numbers stay safe
      let maxNum = 0;
      orders.forEach(o => {
        const n = parseInt(String(o.orderNumber).replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      });
      const next = maxNum + 1;
      // Pad to at least 6 digits (000001); grows past 6 digits if needed (1000000+)
      return String(next).padStart(6, '0');
    }

    function generateUUID() {
      return 'ord_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    function getTodayDateStr() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    function formatCurrency(val) {
      const num = Number(val) || 0;
      return '₱' + num.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function escapeHTML(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatFullAddress(addr) {
      if (!addr) return 'No address provided';
      const parts = [
        addr.houseStreet,
        addr.brgy ? `Brgy. ${addr.brgy}` : '',
        addr.city,
        addr.province,
        addr.zip
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'No address provided';
    }

    // -------------------------------------------------------------------------
    // 3. LIVE SUMMARY CARDS, TABS & FILTERS
    // -------------------------------------------------------------------------
    function updateDashboardStats() {
      const ongoingOrders = orders.filter(o => o.stage === 'ongoing');
      const shippingOrders = orders.filter(o => o.stage === 'shipping');
      const completedOrders = orders.filter(o => o.stage === 'completed');

      const unpaidTotalCount = orders.filter(o => !o.isPaid).length;

      const paidRevenue = orders
        .filter(o => o.isPaid)
        .reduce((sum, o) => sum + (Number(o.subtotal) || 0) + (Number(o.shippingAmount) || 0), 0);

      const totalOrderValue = orders
        .reduce((sum, o) => sum + (Number(o.subtotal) || 0) + (Number(o.shippingAmount) || 0), 0);

      // Update Top Summary Cards
      document.getElementById('statOngoingCount').textContent = ongoingOrders.length;
      document.getElementById('statOngoingSub').textContent = `${unpaidTotalCount} unpaid across tracker`;

      document.getElementById('statShippingCount').textContent = shippingOrders.length;
      document.getElementById('statShippingSub').textContent =
        shippingOrders.length === 1 ? '1 parcel in transit' : `${shippingOrders.length} parcels in transit`;

      document.getElementById('statCompletedCount').textContent = completedOrders.length;
      document.getElementById('statCompletedSub').textContent =
        completedOrders.length === 1 ? '1 order delivered' : `${completedOrders.length} orders delivered`;

      document.getElementById('statPaidRevenue').textContent = formatCurrency(paidRevenue);
      document.getElementById('statTotalValueSub').textContent =
        `${formatCurrency(totalOrderValue)} total across ${orders.length} order${orders.length === 1 ? '' : 's'}`;

      // Update Tab Pill Counters
      document.getElementById('badge-ongoing').textContent = ongoingOrders.length;
      document.getElementById('badge-shipping').textContent = shippingOrders.length;
      document.getElementById('badge-completed').textContent = completedOrders.length;
    }

    function switchTab(tabName) {
      currentTab = tabName;
      ['ongoing', 'shipping', 'completed'].forEach(t => {
        const sec = document.getElementById(`section-${t}`);
        const btn = document.getElementById(`tab-${t}`);
        if (t === tabName) {
          sec.classList.remove('hidden');
          btn.classList.add('bg-white', 'text-lavender-600', 'shadow-sm', 'font-bold');
          btn.classList.remove('text-slate-600', 'font-semibold');
        } else {
          sec.classList.add('hidden');
          btn.classList.remove('bg-white', 'text-lavender-600', 'shadow-sm', 'font-bold');
          btn.classList.add('text-slate-600', 'font-semibold');
        }
      });
      renderTables();
    }

    function setPaymentFilter(filter) {
      paymentFilter = filter;
      ['all', 'paid', 'unpaid'].forEach(f => {
        const pill = document.getElementById(`filter-${f}`);
        if (f === filter) {
          pill.classList.add('bg-white', 'text-slate-800', 'shadow-sm', 'font-bold');
          pill.classList.remove('text-slate-600', 'font-semibold');
        } else {
          pill.classList.remove('bg-white', 'text-slate-800', 'shadow-sm', 'font-bold');
          pill.classList.add('text-slate-600', 'font-semibold');
        }
      });
      renderTables();
    }

    function matchesSearchAndFilter(order) {
      if (paymentFilter === 'paid' && !order.isPaid) return false;
      if (paymentFilter === 'unpaid' && order.isPaid) return false;

      const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
      if (!q) return true;

      const socmedStr = (order.socmeds || []).map(s => `${s.platform} ${s.handle}`).join(' ').toLowerCase();
      const itemsStr = (order.items || []).map(i => i.name).join(' ').toLowerCase();
      const addrStr = formatFullAddress(order.address).toLowerCase();

      return (
        String(order.orderNumber).toLowerCase().includes(q) ||
        (order.fullName || '').toLowerCase().includes(q) ||
        (order.contact || '').toLowerCase().includes(q) ||
        socmedStr.includes(q) ||
        itemsStr.includes(q) ||
        addrStr.includes(q) ||
        (order.paymentMethod || '').toLowerCase().includes(q) ||
        (order.shippingOption || '').toLowerCase().includes(q)
      );
    }

    // -------------------------------------------------------------------------
    // 4. TABLE RENDERING (ONGOING, SHIPPING, COMPLETED)
    // -------------------------------------------------------------------------
    function renderSocMedBadges(socmeds) {
      if (!socmeds || socmeds.length === 0) {
        return '<span class="text-xs text-slate-400 italic">No socials</span>';
      }
      return socmeds.map(s => {
        const p = (s.platform || '').toUpperCase();
        let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
        if (p === 'IG' || p === 'INSTAGRAM') badgeClass = 'bg-pink-50 text-pink-700 border-pink-200';
        else if (p === 'X' || p === 'TWITTER') badgeClass = 'bg-slate-900 text-white border-slate-800';
        else if (p === 'FB' || p === 'FACEBOOK') badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badgeClass}">
          <span class="opacity-75">${escapeHTML(s.platform)}:</span> ${escapeHTML(s.handle)}
        </span>`;
      }).join(' ');
    }

    function renderItemsList(items) {
      if (!items || items.length === 0) {
        return '<span class="text-xs text-slate-400 italic">No items listed</span>';
      }
      return `<ul class="space-y-1">
        ${items.map(item => `
          <li class="text-xs text-slate-700 flex items-start justify-between gap-2">
            <span><span class="font-bold text-lavender-700">${item.qty}×</span> ${escapeHTML(item.name)}</span>
            <span class="text-slate-400 font-mono shrink-0">${formatCurrency(item.qty * item.price)}</span>
          </li>
        `).join('')}
      </ul>`;
    }

    function renderTables() {
      updateDashboardStats();

      const ongoingList = orders.filter(o => o.stage === 'ongoing' && matchesSearchAndFilter(o));
      const shippingList = orders.filter(o => o.stage === 'shipping' && matchesSearchAndFilter(o));
      const completedList = orders.filter(o => o.stage === 'completed' && matchesSearchAndFilter(o));

      // 1. Render ONGOING Table
      const tbodyOngoing = document.getElementById('tbody-ongoing');
      const emptyOngoing = document.getElementById('empty-ongoing');
      if (ongoingList.length === 0) {
        tbodyOngoing.innerHTML = '';
        emptyOngoing.classList.remove('hidden');
      } else {
        emptyOngoing.classList.add('hidden');
        tbodyOngoing.innerHTML = ongoingList.map(order => `
          <tr class="hover:bg-lavender-50/50 transition-colors align-top">
            <td class="py-4 px-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg bg-lavender-100 text-lavender-700 font-mono font-extrabold text-xs border border-lavender-200">
                #${escapeHTML(order.orderNumber)}
              </span>
            </td>
            <td class="py-4 px-4 min-w-[180px]">
              <p class="font-bold text-slate-900">${escapeHTML(order.fullName)}</p>
              <div class="flex flex-wrap gap-1 mt-1.5">
                ${renderSocMedBadges(order.socmeds)}
              </div>
            </td>
            <td class="py-4 px-4 min-w-[200px] max-w-xs">
              <p class="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <i data-lucide="phone" class="w-3 h-3 text-slate-400"></i>
                ${escapeHTML(order.contact)}
              </p>
              <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                ${escapeHTML(formatFullAddress(order.address))}
              </p>
            </td>
            <td class="py-4 px-4 min-w-[220px]">
              ${renderItemsList(order.items)}
            </td>
            <td class="py-4 px-4 whitespace-nowrap">
              <span class="font-display font-extrabold text-base text-slate-900">
                ${formatCurrency(order.subtotal)}
              </span>
            </td>
            <td class="py-4 px-4 whitespace-nowrap">
              <p class="text-xs font-bold text-slate-800">${escapeHTML(order.shippingOption)}</p>
              <span class="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cream-100 text-slate-700 border border-cream-200">
                ${escapeHTML(order.shippingStatus)}
              </span>
            </td>
            <td class="py-4 px-4 whitespace-nowrap">
              <p class="text-xs font-bold text-slate-700 mb-1.5">${escapeHTML(order.paymentMethod)}</p>
              <button type="button" onclick="toggleInlinePaidStatus('${order.id}')"
                title="Click to toggle Paid / Unpaid status"
                class="btn-trendy inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                  order.isPaid
                    ? 'bg-sage-100 text-sage-700 border-sage-200'
                    : 'bg-peach-100 text-peach-600 border-peach-200'
                }">
                <i data-lucide="${order.isPaid ? 'check-circle-2' : 'clock'}" class="w-3.5 h-3.5"></i>
                <span>${order.isPaid ? 'Paid ✓' : 'Unpaid'}</span>
              </button>
              ${order.paymentReminder ? `<p class="text-[10px] font-bold text-amber-600 mt-1">${escapeHTML(order.paymentReminder)}</p>` : ''}
              ${order.notes ? `<p class="text-[10px] text-slate-400 mt-0.5 max-w-[140px] truncate" title="${escapeHTML(order.notes)}">📝 ${escapeHTML(order.notes)}</p>` : ''}
            </td>
            <td class="py-4 px-4 whitespace-nowrap text-right">
              <div class="inline-flex items-center justify-end gap-1.5 flex-wrap">
                <button type="button" onclick="openOrderModal('${order.id}')" title="Edit Entry"
                  class="btn-trendy p-2 rounded-xl bg-white text-slate-700 border border-slate-200 shadow-tactile hover:bg-cream-100">
                  <i data-lucide="pencil" class="w-3.5 h-3.5 text-lavender-600"></i>
                </button>
                <button type="button" onclick="requestDeleteOrder('${order.id}')" title="Delete Entry"
                  class="btn-trendy p-2 rounded-xl bg-white text-rose-600 border border-slate-200 shadow-tactile hover:bg-rose-50">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="generateInvoice('${order.id}')" title="Generate Invoice"
                  class="btn-trendy inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold bg-lavender-600 text-white shadow-tactile-primary hover:bg-lavender-500">
                  <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                  <span>Invoice</span>
                </button>
                <button type="button" onclick="openShipModal('${order.id}')"
                  class="btn-trendy inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold bg-amber-500 text-white shadow-tactile-amber hover:bg-amber-600">
                  <span>Ship Order</span>
                  <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }

      // 2. Render SHIPPING Table
      const tbodyShipping = document.getElementById('tbody-shipping');
      const emptyShipping = document.getElementById('empty-shipping');
      if (shippingList.length === 0) {
        tbodyShipping.innerHTML = '';
        emptyShipping.classList.remove('hidden');
      } else {
        emptyShipping.classList.add('hidden');
        tbodyShipping.innerHTML = shippingList.map(order => {
          const grandTotal = (Number(order.subtotal) || 0) + (Number(order.shippingAmount) || 0);
          return `
            <tr class="hover:bg-amber-50/40 transition-colors align-top">
              <td class="py-4 px-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-mono font-extrabold text-xs border border-amber-200">
                  #${escapeHTML(order.orderNumber)}
                </span>
              </td>
              <td class="py-4 px-4 min-w-[200px] max-w-xs">
                <p class="font-bold text-slate-900">${escapeHTML(order.fullName)}</p>
                <p class="text-xs text-slate-600 mt-0.5">${escapeHTML(order.contact)}</p>
                <p class="text-xs text-slate-500 mt-1">${escapeHTML(formatFullAddress(order.address))}</p>
              </td>
              <td class="py-4 px-4 min-w-[210px]">
                ${renderItemsList(order.items)}
                <div class="mt-2 pt-1.5 border-t border-slate-100 text-xs space-y-0.5">
                  <div class="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(order.subtotal)}</span>
                  </div>
                  <div class="flex justify-between text-amber-700 font-semibold">
                    <span>Shipping Fee:</span>
                    <span>+${formatCurrency(order.shippingAmount)}</span>
                  </div>
                  <div class="flex justify-between font-extrabold text-slate-900 text-sm pt-0.5">
                    <span>Total:</span>
                    <span>${formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </td>
              <td class="py-4 px-4 whitespace-nowrap">
                <p class="text-xs font-bold text-slate-800">${escapeHTML(order.shippedDate || '—')}</p>
                <p class="text-xs text-slate-500 mt-0.5">${escapeHTML(order.shippingOption)}</p>
              </td>
              <td class="py-4 px-4 min-w-[190px] max-w-xs">
                <div class="ship-details-box p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-slate-700 leading-relaxed">
                  ${escapeHTML(order.shippingDetails || 'No tracking details')}
                </div>
              </td>
              <td class="py-4 px-4 whitespace-nowrap">
                <p class="text-xs font-bold text-slate-700 mb-1.5">${escapeHTML(order.paymentMethod)}</p>
                <button type="button" onclick="toggleInlinePaidStatus('${order.id}')"
                  class="btn-trendy inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                    order.isPaid
                      ? 'bg-sage-100 text-sage-700 border-sage-200'
                      : 'bg-peach-100 text-peach-600 border-peach-200'
                  }">
                  <i data-lucide="${order.isPaid ? 'check-circle-2' : 'clock'}" class="w-3.5 h-3.5"></i>
                  <span>${order.isPaid ? 'Paid ✓' : 'Unpaid'}</span>
                </button>
              </td>
              <td class="py-4 px-4 whitespace-nowrap text-right">
                <div class="inline-flex items-center justify-end gap-1.5 flex-wrap">
                  <button type="button" onclick="openOrderModal('${order.id}')" title="Edit Entry"
                    class="btn-trendy p-2 rounded-xl bg-white text-slate-700 border border-slate-200 shadow-tactile hover:bg-cream-100">
                    <i data-lucide="pencil" class="w-3.5 h-3.5 text-lavender-600"></i>
                  </button>
                  <button type="button" onclick="requestDeleteOrder('${order.id}')" title="Delete Entry"
                    class="btn-trendy p-2 rounded-xl bg-white text-rose-600 border border-slate-200 shadow-tactile hover:bg-rose-50">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                  <button type="button" onclick="generateInvoice('${order.id}')" title="Generate Invoice for payment"
                    class="btn-trendy inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold bg-lavender-600 text-white shadow-tactile-primary hover:bg-lavender-500">
                    <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                    <span>Invoice</span>
                  </button>
                  <button type="button" onclick="requestConfirmDelivered('${order.id}')"
                    class="btn-trendy inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold bg-sage-600 text-white shadow-tactile-sage hover:bg-sage-700">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                    <span>Confirm Delivered</span>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      // 3. Render COMPLETED Table
      const tbodyCompleted = document.getElementById('tbody-completed');
      const emptyCompleted = document.getElementById('empty-completed');
      if (completedList.length === 0) {
        tbodyCompleted.innerHTML = '';
        emptyCompleted.classList.remove('hidden');
      } else {
        emptyCompleted.classList.add('hidden');
        tbodyCompleted.innerHTML = completedList.map(order => {
          const grandTotal = (Number(order.subtotal) || 0) + (Number(order.shippingAmount) || 0);
          return `
            <tr class="hover:bg-sage-50/50 transition-colors align-top">
              <td class="py-4 px-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-1 rounded-lg bg-sage-100 text-sage-700 font-mono font-extrabold text-xs border border-sage-200">
                  #${escapeHTML(order.orderNumber)}
                </span>
              </td>
              <td class="py-4 px-4 min-w-[180px]">
                <p class="font-bold text-slate-900">${escapeHTML(order.fullName)}</p>
                <div class="flex flex-wrap gap-1 mt-1.5">
                  ${renderSocMedBadges(order.socmeds)}
                </div>
              </td>
              <td class="py-4 px-4 min-w-[210px]">
                ${renderItemsList(order.items)}
              </td>
              <td class="py-4 px-4 whitespace-nowrap">
                <p class="font-display font-extrabold text-base text-slate-900">${formatCurrency(grandTotal)}</p>
                <p class="text-[11px] text-slate-500">
                  ${escapeHTML(order.paymentMethod)} • ${order.isPaid ? '<span class="text-sage-700 font-bold">Paid ✓</span>' : '<span class="text-peach-600 font-bold">Unpaid</span>'}
                </p>
              </td>
              <td class="py-4 px-4 min-w-[180px] max-w-xs">
                <p class="text-xs font-bold text-slate-700">${escapeHTML(order.shippingOption)} (${formatCurrency(order.shippingAmount)})</p>
                <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">${escapeHTML(order.shippingDetails || '—')}</p>
              </td>
              <td class="py-4 px-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sage-100 text-sage-700">
                  <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i>
                  ${escapeHTML(order.deliveredDate || order.shippedDate || 'Delivered')}
                </span>
              </td>
              <td class="py-4 px-4 whitespace-nowrap text-right">
                <div class="inline-flex items-center justify-end gap-1.5">
                  <button type="button" onclick="openReceiptModal('${order.id}')"
                    class="btn-trendy inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-lavender-600 text-white shadow-tactile-primary hover:bg-lavender-500">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>Show Order</span>
                  </button>
                  <button type="button" onclick="requestDeleteOrder('${order.id}')" title="Delete Entry"
                    class="btn-trendy p-2 rounded-xl bg-white text-rose-600 border border-slate-200 shadow-tactile hover:bg-rose-50">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      lucide.createIcons();
    }

    // -------------------------------------------------------------------------
    // 5. ADD / EDIT ORDER MODAL & DYNAMIC ROWS (SOCMEDS & ITEMIZED ITEMS)
    // -------------------------------------------------------------------------
    function openOrderModal(orderId = null) {
      const modal = document.getElementById('orderModal');
      const title = document.getElementById('orderModalTitle');
      const extraShippingSec = document.getElementById('extraShippingFieldsSection');

      document.getElementById('orderForm').reset();
      document.getElementById('socMedContainer').innerHTML = '';
      document.getElementById('itemsContainer').innerHTML = '';
      document.getElementById('customShippingOptionWrapper').classList.add('hidden');
      document.getElementById('customPaymentWrapper').classList.add('hidden');

      if (orderId) {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        title.textContent = `Edit Order #${order.orderNumber}`;
        document.getElementById('editOrderId').value = order.id;
        document.getElementById('fieldOrderNumber').value = order.orderNumber;

        document.getElementById('fieldFullName').value = order.fullName || '';
        document.getElementById('fieldContact').value = order.contact || '';

        const addr = order.address || {};
        document.getElementById('fieldHouseStreet').value = addr.houseStreet || '';
        document.getElementById('fieldBrgy').value = addr.brgy || '';
        document.getElementById('fieldCity').value = addr.city || '';
        document.getElementById('fieldProvince').value = addr.province || '';
        document.getElementById('fieldZip').value = addr.zip || '';

        // Populate SocMeds
        if (order.socmeds && order.socmeds.length > 0) {
          order.socmeds.forEach(s => addSocMedRow(s.platform, s.handle));
        } else {
          addSocMedRow('IG', '');
        }

        // Populate Items
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => addItemRow(item.name, item.qty, item.price, item.type || 'merch'));
        } else {
          addItemRow('', 1, 0, 'merch');
        }

        document.getElementById('fieldSubtotal').value = (Number(order.subtotal) || 0).toFixed(2);

        // Shipping Option
        setSelectOrCustom('fieldShippingOption', 'customShippingOptionWrapper', 'fieldCustomShippingOption', order.shippingOption);
        document.getElementById('fieldShippingStatus').value = order.shippingStatus || 'Preparing';

        // Payment Method
        setSelectOrCustom('fieldPaymentMethod', 'customPaymentWrapper', 'fieldCustomPaymentMethod', order.paymentMethod);

        // Paid Status
        setFormPaidStatus(Boolean(order.isPaid));

        // Payment reminder & notes
        const remEl = document.getElementById('fieldPaymentReminder');
        if (remEl) remEl.value = order.paymentReminder || '';
        const notesEl = document.getElementById('fieldNotes');
        if (notesEl) notesEl.value = order.notes || '';

        // Extra shipping fields if in Shipping or Completed
        if (order.stage === 'shipping' || order.stage === 'completed') {
          extraShippingSec.classList.remove('hidden');
          document.getElementById('fieldEditShippingAmount').value = order.shippingAmount || 0;
          document.getElementById('fieldEditShippedDate').value = order.shippedDate || '';
          document.getElementById('fieldEditShippingDetails').value = order.shippingDetails || '';
        } else {
          extraShippingSec.classList.add('hidden');
        }
      } else {
        title.textContent = 'New Order Entry';
        document.getElementById('editOrderId').value = '';
        document.getElementById('fieldOrderNumber').value = generateUniqueOrderNumber();
        extraShippingSec.classList.add('hidden');

        addSocMedRow('IG', '');
        addItemRow('', 1, '', 'merch');
        document.getElementById('fieldSubtotal').value = '0.00';
        setFormPaidStatus(false);
        const remEl = document.getElementById('fieldPaymentReminder');
        if (remEl) remEl.value = '';
        const notesEl = document.getElementById('fieldNotes');
        if (notesEl) notesEl.value = '';
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      lucide.createIcons();
    }

    function closeOrderModal() {
      const modal = document.getElementById('orderModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    function regenerateOrderNumber() {
      document.getElementById('fieldOrderNumber').value = generateUniqueOrderNumber();
    }

    function setSelectOrCustom(selectId, wrapperId, customInputId, value) {
      const select = document.getElementById(selectId);
      const wrapper = document.getElementById(wrapperId);
      const customInput = document.getElementById(customInputId);
      const options = Array.from(select.options).map(o => o.value);

      if (options.includes(value)) {
        select.value = value;
        wrapper.classList.add('hidden');
      } else if (value) {
        select.value = '__CUSTOM__';
        wrapper.classList.remove('hidden');
        customInput.value = value;
      }
    }

    function toggleCustomInput(selectId, wrapperId) {
      const select = document.getElementById(selectId);
      const wrapper = document.getElementById(wrapperId);
      if (select.value === '__CUSTOM__') {
        wrapper.classList.remove('hidden');
      } else {
        wrapper.classList.add('hidden');
      }
    }

    // Dynamic SocMed Row (IG, X, FB, + Custom)
    function addSocMedRow(platform = 'IG', handle = '') {
      const container = document.getElementById('socMedContainer');
      const row = document.createElement('div');
      row.className = 'socmed-row flex items-center gap-2';

      const presetPlatforms = ['IG', 'X', 'FB'];
      const isPreset = presetPlatforms.includes(platform);

      row.innerHTML = `
        <select onchange="handleSocMedPlatformChange(this)"
          class="socmed-select w-28 sm:w-32 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-lavender-500/40">
          <option value="IG" ${platform === 'IG' ? 'selected' : ''}>IG</option>
          <option value="X" ${platform === 'X' ? 'selected' : ''}>X</option>
          <option value="FB" ${platform === 'FB' ? 'selected' : ''}>FB</option>
          <option value="__CUSTOM__" ${!isPreset ? 'selected' : ''}>+ Custom</option>
        </select>
        <input type="text" placeholder="Platform (e.g., TikTok)" value="${!isPreset ? escapeHTML(platform) : ''}"
          class="socmed-custom-platform ${isPreset ? 'hidden' : ''} w-28 sm:w-32 px-3 py-2 rounded-xl bg-cream-50 border border-lavender-300 text-xs sm:text-sm font-semibold" />
        <input type="text" placeholder="@username or profile link" value="${escapeHTML(handle)}"
          class="socmed-handle flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-lavender-500/40" />
        <button type="button" onclick="this.parentElement.remove()" title="Remove SocMed"
          class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      `;
      container.appendChild(row);
      lucide.createIcons();
    }

    function handleSocMedPlatformChange(selectEl) {
      const customInput = selectEl.parentElement.querySelector('.socmed-custom-platform');
      if (selectEl.value === '__CUSTOM__') {
        customInput.classList.remove('hidden');
        customInput.focus();
      } else {
        customInput.classList.add('hidden');
      }
    }

    // Dynamic Itemized Order Row (with inventory picker + merch/commission type)
    function addItemRow(name = '', qty = 1, price = '', type = '') {
      const container = document.getElementById('itemsContainer');
      const row = document.createElement('div');
      row.className = 'item-row grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-lavender-200/70';

      const lineTotal = (Number(qty) || 0) * (Number(price) || 0);
      const invMatch = inventory.find(i => i.name.toLowerCase() === String(name).toLowerCase());
      const resolvedType = type || (invMatch && invMatch.type) || 'merch';
      const stockDisplay = (resolvedType === 'commission') ? '∞' : (invMatch ? invMatch.stock : '—');
      const stockClass = resolvedType === 'commission'
        ? 'text-lavender-600'
        : (invMatch
          ? (invMatch.stock <= 0 ? 'text-rose-600' : (invMatch.stock <= 3 ? 'text-amber-600' : 'text-sage-700'))
          : 'text-slate-400');

      const listId = 'inv-datalist-' + Math.random().toString(36).slice(2, 8);

      row.innerHTML = `
        <div class="col-span-12 sm:col-span-4">
          <input type="text" list="${listId}" placeholder="Pick from inventory or type new..." value="${escapeHTML(name)}"
            oninput="onItemNameInput(this)" onchange="onItemNameInput(this)"
            class="item-name w-full px-2.5 py-1.5 rounded-lg bg-cream-50/60 border border-slate-200 text-sm focus:outline-none focus:border-lavender-500" />
          <datalist id="${listId}">
            ${inventory.map(i => `<option value="${escapeHTML(i.name)}" data-price="${i.price}" data-stock="${i.stock}" data-type="${i.type || 'merch'}">${escapeHTML(i.name)} (${i.type === 'commission' ? 'comm' : 'merch'} · ${formatCurrency(i.price)})</option>`).join('')}
          </datalist>
        </div>
        <div class="col-span-4 sm:col-span-2">
          <select class="item-type w-full px-1.5 py-1.5 rounded-lg bg-cream-50/60 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-lavender-500" onchange="onItemTypeChange(this)">
            <option value="merch" ${resolvedType === 'merch' ? 'selected' : ''}>Merch</option>
            <option value="commission" ${resolvedType === 'commission' ? 'selected' : ''}>Commission</option>
          </select>
        </div>
        <div class="col-span-2 sm:col-span-1 text-center">
          <span class="item-stock text-xs font-bold ${stockClass}" title="Stock (merch only)">${stockDisplay}</span>
        </div>
        <div class="col-span-3 sm:col-span-1">
          <input type="number" min="1" step="1" value="${qty}" oninput="recalculateSubtotal()"
            class="item-qty w-full px-1 py-1.5 rounded-lg bg-cream-50/60 border border-slate-200 text-sm text-center font-semibold focus:outline-none focus:border-lavender-500" />
        </div>
        <div class="col-span-3 sm:col-span-2">
          <input type="number" min="0" step="0.01" placeholder="0.00" value="${price}" oninput="recalculateSubtotal()"
            class="item-price w-full px-2 py-1.5 rounded-lg bg-cream-50/60 border border-slate-200 text-sm text-right font-semibold focus:outline-none focus:border-lavender-500" />
        </div>
        <div class="col-span-12 sm:col-span-2 flex items-center justify-end gap-1">
          <span class="item-line-total text-xs font-bold text-slate-700 font-mono truncate">${formatCurrency(lineTotal)}</span>
          <button type="button" onclick="removeItemRow(this)" title="Remove item"
            class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
      container.appendChild(row);
      lucide.createIcons();
    }

    function onItemTypeChange(selectEl) {
      const row = selectEl.closest('.item-row');
      if (!row) return;
      const stockEl = row.querySelector('.item-stock');
      const name = (row.querySelector('.item-name')?.value || '').trim();
      const inv = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
      if (selectEl.value === 'commission') {
        if (stockEl) {
          stockEl.textContent = '∞';
          stockEl.className = 'item-stock text-xs font-bold text-lavender-600';
        }
      } else if (inv && stockEl) {
        stockEl.textContent = inv.stock;
        stockEl.className = 'item-stock text-xs font-bold ' +
          (inv.stock <= 0 ? 'text-rose-600' : (inv.stock <= 3 ? 'text-amber-600' : 'text-sage-700'));
      } else if (stockEl) {
        stockEl.textContent = '—';
        stockEl.className = 'item-stock text-xs font-bold text-slate-400';
      }
    }

    function onItemNameInput(inputEl) {
      const name = (inputEl.value || '').trim();
      const row = inputEl.closest('.item-row');
      if (!row) return;
      const inv = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
      const stockEl = row.querySelector('.item-stock');
      const priceEl = row.querySelector('.item-price');
      const typeEl = row.querySelector('.item-type');
      if (inv) {
        if (typeEl && inv.type) typeEl.value = inv.type;
        const isComm = (typeEl?.value || inv.type) === 'commission';
        if (stockEl) {
          if (isComm) {
            stockEl.textContent = '∞';
            stockEl.className = 'item-stock text-xs font-bold text-lavender-600';
          } else {
            stockEl.textContent = inv.stock;
            stockEl.className = 'item-stock text-xs font-bold ' +
              (inv.stock <= 0 ? 'text-rose-600' : (inv.stock <= 3 ? 'text-amber-600' : 'text-sage-700'));
          }
        }
        if (priceEl && (!priceEl.value || parseFloat(priceEl.value) === 0)) {
          priceEl.value = Number(inv.price).toFixed(2);
        }
      } else {
        if (stockEl) {
          const isComm = typeEl?.value === 'commission';
          stockEl.textContent = isComm ? '∞' : '—';
          stockEl.className = 'item-stock text-xs font-bold ' + (isComm ? 'text-lavender-600' : 'text-slate-400');
        }
      }
      recalculateSubtotal();
    }

    function removeItemRow(btn) {
      const container = document.getElementById('itemsContainer');
      if (container.children.length > 1) {
        btn.closest('.item-row').remove();
        recalculateSubtotal();
      } else {
        showToast('At least one item row is required.', 'peach');
      }
    }

    function recalculateSubtotal() {
      let sum = 0;
      document.querySelectorAll('#itemsContainer .item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const line = qty * price;
        row.querySelector('.item-line-total').textContent = formatCurrency(line);
        sum += line;
      });
      document.getElementById('fieldSubtotal').value = sum.toFixed(2);
    }

    // Paid Status Confirm Toggle inside Form
    function toggleFormPaidStatus() {
      const current = document.getElementById('fieldIsPaid').value === 'true';
      setFormPaidStatus(!current);
    }

    function setFormPaidStatus(isPaid) {
      document.getElementById('fieldIsPaid').value = isPaid ? 'true' : 'false';
      const btn = document.getElementById('formPaidToggleBtn');
      const text = document.getElementById('formPaidToggleText');

      if (isPaid) {
        btn.className = 'w-full py-2 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all bg-sage-100 border-sage-400 text-sage-700';
        btn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Paid Confirmed ✓</span>`;
      } else {
        btn.className = 'w-full py-2 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all bg-peach-100 border-peach-300 text-peach-600';
        btn.innerHTML = `<i data-lucide="clock" class="w-4 h-4"></i><span>Unpaid — Click to Confirm Paid</span>`;
      }
      lucide.createIcons();
    }

    // Handle Form Submit -> Trigger Confirm Save Dialog
    function handleOrderFormSubmit(e) {
      e.preventDefault();

      const editId = document.getElementById('editOrderId').value;
      const orderNumber = document.getElementById('fieldOrderNumber').value.trim();
      const fullName = document.getElementById('fieldFullName').value.trim();
      const contact = document.getElementById('fieldContact').value.trim();

      // Collect SocMeds
      const socmeds = [];
      document.querySelectorAll('#socMedContainer .socmed-row').forEach(row => {
        const sel = row.querySelector('.socmed-select').value;
        const customPlat = row.querySelector('.socmed-custom-platform').value.trim();
        const handle = row.querySelector('.socmed-handle').value.trim();
        const platform = sel === '__CUSTOM__' ? (customPlat || 'Other') : sel;
        if (handle) {
          socmeds.push({ platform, handle });
        }
      });

      // Collect Address
      const address = {
        houseStreet: document.getElementById('fieldHouseStreet').value.trim(),
        brgy: document.getElementById('fieldBrgy').value.trim(),
        city: document.getElementById('fieldCity').value.trim(),
        province: document.getElementById('fieldProvince').value.trim(),
        zip: document.getElementById('fieldZip').value.trim()
      };

      // Collect Itemized Items
      const items = [];
      document.querySelectorAll('#itemsContainer .item-row').forEach(row => {
        const name = row.querySelector('.item-name').value.trim();
        const qty = parseInt(row.querySelector('.item-qty').value, 10) || 1;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const type = row.querySelector('.item-type')?.value || 'merch';
        if (name) {
          items.push({ name, qty, price, type });
        }
      });

      const subtotal = parseFloat(document.getElementById('fieldSubtotal').value) || 0;

      // Shipping Option
      const shipSel = document.getElementById('fieldShippingOption').value;
      const shippingOption = shipSel === '__CUSTOM__'
        ? (document.getElementById('fieldCustomShippingOption').value.trim() || 'Custom Shipping')
        : shipSel;

      const shippingStatus = document.getElementById('fieldShippingStatus').value;

      // Payment Method
      const paySel = document.getElementById('fieldPaymentMethod').value;
      const paymentMethod = paySel === '__CUSTOM__'
        ? (document.getElementById('fieldCustomPaymentMethod').value.trim() || 'Other')
        : paySel;

      const isPaid = document.getElementById('fieldIsPaid').value === 'true';
      const paymentReminder = document.getElementById('fieldPaymentReminder')?.value || '';
      const notes = document.getElementById('fieldNotes')?.value.trim() || '';

      openConfirmDialog({
        title: editId ? 'Confirm Save Changes?' : 'Confirm Save New Order?',
        message: editId
          ? `Save updates to Order #${orderNumber} for ${fullName}?`
          : `Add Order #${orderNumber} (${fullName} — ${formatCurrency(subtotal)}) to Ongoing Orders?`,
        icon: 'check-circle',
        theme: 'primary',
        confirmText: 'Confirm Save',
        onConfirm: () => {
          if (editId) {
            pushHistory(`Edit Order #${orderNumber}`);
            const idx = orders.findIndex(o => o.id === editId);
            if (idx !== -1) {
              const existing = orders[idx];
              const updated = {
                ...existing,
                fullName,
                socmeds,
                contact,
                address,
                items,
                subtotal,
                shippingOption,
                shippingStatus,
                paymentMethod,
                isPaid,
                paymentReminder,
                notes
              };

              if (existing.stage === 'shipping' || existing.stage === 'completed') {
                updated.shippingAmount = parseFloat(document.getElementById('fieldEditShippingAmount').value) || 0;
                updated.shippedDate = document.getElementById('fieldEditShippedDate').value;
                updated.shippingDetails = document.getElementById('fieldEditShippingDetails').value.trim();
              }

              orders[idx] = updated;
            }
            showToast(`Order #${orderNumber} updated & saved!`, 'sage');
          } else {
            pushHistory(`Add Order #${orderNumber}`);
            const newOrder = {
              id: generateUUID(),
              orderNumber,
              fullName,
              socmeds,
              contact,
              address,
              items,
              subtotal,
              shippingOption,
              shippingStatus,
              paymentMethod,
              isPaid,
              paymentReminder,
              notes,
              stage: 'ongoing',
              shippingAmount: 0,
              shippedDate: '',
              shippingDetails: '',
              deliveredDate: '',
              createdAt: new Date().toISOString()
            };
            orders.unshift(newOrder);
            // Reflect items onto inventory: deduct stock for merch only
            syncInventoryFromOrderItems(items, true);
            switchTab('ongoing');
            showToast(`Order #${orderNumber} added to Ongoing!`, 'sage');
          }

          saveStateToStorage();
          closeOrderModal();
          renderTables();
          renderInventoryTable();
        }
      });
    }

    // -------------------------------------------------------------------------
    // 6. INLINE PAID STATUS TOGGLE, DELETE & STAGE TRANSITIONS
    // -------------------------------------------------------------------------
    function toggleInlinePaidStatus(orderId) {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) return;

      const order = orders[idx];
      pushHistory(`Toggle paid status for #${order.orderNumber}`);
      orders[idx].isPaid = !order.isPaid;

      saveStateToStorage();
      renderTables();
      showToast(
        `Order #${order.orderNumber} marked as ${orders[idx].isPaid ? 'Paid ✓' : 'Unpaid'}`,
        orders[idx].isPaid ? 'sage' : 'peach'
      );
    }

    function requestDeleteOrder(orderId) {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const willRestoreStock = order.stage === 'ongoing' || order.stage === 'shipping';
      const stockNote = willRestoreStock
        ? ' Items from this order will be returned to inventory stock.'
        : '';

      openConfirmDialog({
        title: `Delete Order #${order.orderNumber}?`,
        message: `Are you sure you want to delete ${order.fullName}'s order?${stockNote} You can still click Undo if needed.`,
        icon: 'trash-2',
        theme: 'danger',
        confirmText: 'Confirm Delete',
        onConfirm: () => {
          pushHistory(`Delete Order #${order.orderNumber}`);
          // Restore stock for ongoing/shipping orders (not completed — those are already fulfilled)
          if (willRestoreStock) {
            restoreInventoryFromOrderItems(order.items || []);
          }
          orders = orders.filter(o => o.id !== orderId);
          saveStateToStorage();
          renderTables();
          renderInventoryTable();
          showToast(
            willRestoreStock
              ? `Order #${order.orderNumber} deleted · stock restored.`
              : `Order #${order.orderNumber} deleted.`,
            'peach'
          );
        }
      });
    }

    function requestClearAllOrders() {
      if (orders.length === 0) {
        showToast('Tracker is already empty!', 'lavender');
        return;
      }

      openConfirmDialog({
        title: 'Clear All Orders?',
        message: `This will remove all ${orders.length} order(s) across Ongoing, Shipping, and Completed tables. Your empty tracker will auto-save.`,
        icon: 'trash-2',
        theme: 'danger',
        confirmText: 'Confirm Clear All',
        onConfirm: () => {
          pushHistory(`Clear all (${orders.length} orders)`);
          orders = [];
          saveStateToStorage();
          renderTables();
          showToast('All orders cleared & auto-saved!', 'peach');
        }
      });
    }

    // Ship Order Modal Workflow (Ongoing -> Shipping)
    function openShipModal(orderId) {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      document.getElementById('shipTargetOrderId').value = order.id;
      document.getElementById('shipModalSubtitle').textContent = `Order #${order.orderNumber} — ${order.fullName}`;
      document.getElementById('shipAmountInput').value = order.shippingAmount || '';
      document.getElementById('shipDateInput').value = order.shippedDate || getTodayDateStr();
      document.getElementById('shipDetailsInput').value = order.shippingDetails || `${order.shippingOption} — `;

      const modal = document.getElementById('shipModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      lucide.createIcons();
    }

    function closeShipModal() {
      const modal = document.getElementById('shipModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    function confirmShipOrder(e) {
      e.preventDefault();
      const orderId = document.getElementById('shipTargetOrderId').value;
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) return;

      const shippingAmount = parseFloat(document.getElementById('shipAmountInput').value) || 0;
      const shippedDate = document.getElementById('shipDateInput').value;
      const shippingDetails = document.getElementById('shipDetailsInput').value.trim();

      pushHistory(`Ship Order #${orders[idx].orderNumber}`);
      orders[idx] = {
        ...orders[idx],
        stage: 'shipping',
        shippingStatus: 'In Transit',
        shippingAmount,
        shippedDate,
        shippingDetails
      };

      saveStateToStorage();
      closeShipModal();
      switchTab('shipping');
      showToast(`Order #${orders[idx].orderNumber} moved to Shipping!`, 'amber');
    }

    // Confirm Delivered Workflow (Shipping -> Completed Orders)
    function requestConfirmDelivered(orderId) {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      openConfirmDialog({
        title: 'Confirm Order Delivered?',
        message: `Mark Order #${order.orderNumber} (${order.fullName}) as delivered and move it to Completed Orders?`,
        icon: 'package-check',
        theme: 'sage',
        confirmText: 'Confirm Delivered ✓',
        onConfirm: () => {
          const idx = orders.findIndex(o => o.id === orderId);
          if (idx === -1) return;

          pushHistory(`Deliver Order #${order.orderNumber}`);
          orders[idx] = {
            ...orders[idx],
            stage: 'completed',
            shippingStatus: 'Delivered',
            deliveredDate: getTodayDateStr()
          };

          saveStateToStorage();
          switchTab('completed');
          showToast(`Order #${order.orderNumber} completed! 🎉`, 'sage');
        }
      });
    }

    // -------------------------------------------------------------------------
    // 7. SHOW ORDER / RECEIPT MODAL (COMPLETED ORDERS)
    // -------------------------------------------------------------------------
    function openReceiptModal(orderId) {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      activeReceiptOrder = order;

      const grandTotal = (Number(order.subtotal) || 0) + (Number(order.shippingAmount) || 0);
      document.getElementById('receiptOrderNumber').textContent = `Order #${order.orderNumber}`;

      const socmedList = (order.socmeds || []).length > 0
        ? order.socmeds.map(s => `${s.platform}: ${s.handle}`).join(' | ')
        : 'None';

      document.getElementById('receiptBody').innerHTML = `
        <div class="p-4 rounded-2xl bg-cream-50 border border-cream-200 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Client Name</span>
            <span class="font-bold text-slate-900">${escapeHTML(order.fullName)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Contact #</span>
            <span class="font-semibold text-slate-800">${escapeHTML(order.contact)}</span>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0">SocMeds</span>
            <span class="text-xs font-semibold text-lavender-700 text-right">${escapeHTML(socmedList)}</span>
          </div>
          <div class="pt-2 border-t border-cream-200">
            <span class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">Shipping Address</span>
            <p class="text-xs text-slate-700 leading-relaxed">${escapeHTML(formatFullAddress(order.address))}</p>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 overflow-hidden">
          <div class="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
            Items Ordered
          </div>
          <div class="divide-y divide-slate-100">
            ${(order.items || []).map(item => `
              <div class="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p class="font-bold text-slate-800">${escapeHTML(item.name)}</p>
                  <p class="text-slate-400">${item.qty} × ${formatCurrency(item.price)}</p>
                </div>
                <span class="font-mono font-bold text-slate-900">${formatCurrency(item.qty * item.price)}</span>
              </div>
            `).join('')}
          </div>
          <div class="px-4 py-3 bg-cream-50/80 border-t border-slate-200 space-y-1 text-xs">
            <div class="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span class="font-mono font-semibold">${formatCurrency(order.subtotal)}</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Shipping Amount (${escapeHTML(order.shippingOption)})</span>
              <span class="font-mono font-semibold">${formatCurrency(order.shippingAmount)}</span>
            </div>
            <div class="flex justify-between text-base font-display font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>Grand Total</span>
              <span class="text-sage-700">${formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-lavender-50/70 border border-lavender-200/80 space-y-1.5 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500 font-semibold">Payment Method:</span>
            <span class="font-bold text-slate-800">${escapeHTML(order.paymentMethod)} (${order.isPaid ? 'Paid ✓' : 'Unpaid'})</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500 font-semibold">Shipped Date:</span>
            <span class="font-bold text-slate-800">${escapeHTML(order.shippedDate || '—')}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500 font-semibold">Delivered Date:</span>
            <span class="font-bold text-sage-700">${escapeHTML(order.deliveredDate || '—')}</span>
          </div>
          <div class="pt-1.5 border-t border-lavender-200/60">
            <span class="block text-slate-500 font-semibold mb-0.5">Shipping Details:</span>
            <p class="text-slate-800 font-medium">${escapeHTML(order.shippingDetails || '—')}</p>
          </div>
        </div>
      `;

      const modal = document.getElementById('receiptModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      lucide.createIcons();
    }

    function closeReceiptModal() {
      const modal = document.getElementById('receiptModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    function copyReceiptText() {
      if (!activeReceiptOrder) return;
      const o = activeReceiptOrder;
      const grandTotal = (Number(o.subtotal) || 0) + (Number(o.shippingAmount) || 0);
      const itemsLines = (o.items || []).map(i => `• ${i.qty}x ${i.name} — ${formatCurrency(i.qty * i.price)}`).join('\n');
      const socmedLines = (o.socmeds || []).map(s => `${s.platform}: ${s.handle}`).join(', ') || 'N/A';

      const text = [
        `✨ babu's order tracker — Order #${o.orderNumber}`,
        `Client: ${o.fullName} (${o.contact})`,
        `SocMeds: ${socmedLines}`,
        `Address: ${formatFullAddress(o.address)}`,
        `----------------------------------------`,
        `Items Ordered:`,
        itemsLines,
        `----------------------------------------`,
        `Subtotal: ${formatCurrency(o.subtotal)}`,
        `Shipping (${o.shippingOption}): ${formatCurrency(o.shippingAmount)}`,
        `Grand Total: ${formatCurrency(grandTotal)}`,
        `Payment: ${o.paymentMethod} (${o.isPaid ? 'Paid' : 'Unpaid'})`,
        `Shipped Date: ${o.shippedDate || 'N/A'}`,
        `Shipping Details: ${o.shippingDetails || 'N/A'}`,
        `Delivered Date: ${o.deliveredDate || 'N/A'}`
      ].join('\n');

      const temp = document.createElement('textarea');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      showToast('Order summary copied to clipboard!', 'sage');
    }

    function printReceiptWindow() {
      if (!activeReceiptOrder) return;
      const content = document.getElementById('receiptBody').innerHTML;
      const win = window.open('', '_blank', 'width=600,height=750');
      if (!win) return;
      win.document.write(`
        <html>
          <head>
            <title>Order #${escapeHTML(activeReceiptOrder.orderNumber)} — babu's order tracker</title>
            <style>
              * { box-sizing: border-box; }
              body { font-family: system-ui, -apple-system, sans-serif; color: #1e2430; padding: 32px; margin: 0; line-height: 1.45; }
              h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 4px; }
              .meta { font-size: 0.85rem; font-family: ui-monospace, monospace; color: #64748b; margin-bottom: 24px; }
              .space-y-4 > * + * { margin-top: 16px; }
              .p-4 { padding: 16px; }
              .rounded-2xl { border-radius: 16px; }
              .bg-cream-50, .bg-cream-50\\/80 { background: #fdfbf7; }
              .border { border: 1px solid #e2e8f0; }
              .border-cream-200 { border-color: #efe8d8; }
              .border-slate-200 { border-color: #e2e8f0; }
              .border-t { border-top: 1px solid #e2e8f0; }
              .border-b { border-bottom: 1px solid #e2e8f0; }
              .space-y-2 > * + * { margin-top: 8px; }
              .space-y-1 > * + * { margin-top: 4px; }
              .space-y-1\\.5 > * + * { margin-top: 6px; }
              .flex { display: flex; }
              .items-center { align-items: center; }
              .items-start { align-items: flex-start; }
              .justify-between { justify-content: space-between; }
              .gap-3 { gap: 12px; }
              .gap-4 { gap: 16px; }
              .text-xs { font-size: 0.75rem; }
              .text-sm { font-size: 0.875rem; }
              .text-base { font-size: 1rem; }
              .font-bold { font-weight: 700; }
              .font-semibold { font-weight: 600; }
              .font-extrabold { font-weight: 800; }
              .font-mono { font-family: ui-monospace, monospace; }
              .uppercase { text-transform: uppercase; }
              .tracking-wider { letter-spacing: 0.05em; }
              .text-slate-400 { color: #94a3b8; }
              .text-slate-500 { color: #64748b; }
              .text-slate-600 { color: #475569; }
              .text-slate-700 { color: #334155; }
              .text-slate-800 { color: #1e293b; }
              .text-slate-900 { color: #0f172a; }
              .text-sage-700 { color: #27684b; }
              .text-lavender-700 { color: #5a46c7; }
              .text-right { text-align: right; }
              .shrink-0 { flex-shrink: 0; }
              .pt-1\\.5 { padding-top: 6px; }
              .pt-2 { padding-top: 8px; }
              .px-4 { padding-left: 16px; padding-right: 16px; }
              .py-2 { padding-top: 8px; padding-bottom: 8px; }
              .py-2\\.5 { padding-top: 10px; padding-bottom: 10px; }
              .py-3 { padding-top: 12px; padding-bottom: 12px; }
              .mb-0\\.5 { margin-bottom: 2px; }
              .divide-y > * + * { border-top: 1px solid #f1f5f9; }
              .overflow-hidden { overflow: hidden; }
              .bg-slate-50 { background: #f8fafc; }
              .bg-lavender-50\\/70 { background: #f7f5ff; }
              .border-lavender-200\\/80, .border-lavender-200\\/60 { border-color: #dfd7ff; }
            </style>
          </head>
          <body>
            <h1>babu's order tracker</h1>
            <p class="meta">Receipt for Order #${escapeHTML(activeReceiptOrder.orderNumber)}</p>
            <div class="space-y-4">${content}</div>
            <script>window.onload = () => { window.print(); };<\/script>
          </body>
        </html>
      `);
      win.document.close();
    }

    // Generate a pretty invoice with banner images, QR payment, and thank-you
    function generateInvoice(orderId) {
      const order = orderId
        ? orders.find(o => o.id === orderId)
        : activeReceiptOrder;
      if (!order) {
        showToast('No order selected for invoice.', 'peach');
        return;
      }

      const grandTotal = (Number(order.subtotal) || 0) + (Number(order.shippingAmount) || 0);
      const socmedList = (order.socmeds || []).length > 0
        ? order.socmeds.map(s => `${s.platform}: ${s.handle}`).join(' · ')
        : '—';
      const itemsRows = (order.items || []).map(item => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHTML(item.name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.qty}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.price)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${formatCurrency(item.qty * item.price)}</td>
        </tr>
      `).join('');

      const textVersion = [
        `✨ ORDER INVOICE — babu's order tracker`,
        `Order #${order.orderNumber}`,
        ``,
        `Client: ${order.fullName}`,
        `Contact: ${order.contact}`,
        `SocMeds: ${socmedList}`,
        `Address: ${formatFullAddress(order.address)}`,
        ``,
        `--- ITEMS ---`,
        ...(order.items || []).map(i => `• ${i.qty}x ${i.name} @ ${formatCurrency(i.price)} = ${formatCurrency(i.qty * i.price)}`),
        ``,
        `Subtotal: ${formatCurrency(order.subtotal)}`,
        `Shipping (${order.shippingOption}): ${formatCurrency(order.shippingAmount)}`,
        `GRAND TOTAL: ${formatCurrency(grandTotal)}`,
        ``,
        `Payment: ${order.paymentMethod} (${order.isPaid ? 'Paid ✓' : 'Unpaid'})`,
        `Shipped: ${order.shippedDate || '—'}`,
        `Delivered: ${order.deliveredDate || '—'}`,
        `Tracking: ${order.shippingDetails || '—'}`,
        ``,
        `Thank you for your order! 💖`
      ].join('\n');

      const win = window.open('', '_blank', 'width=720,height=900');
      if (!win) {
        showToast('Please allow pop-ups to view the invoice.', 'peach');
        return;
      }

      win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Invoice #${escapeHTML(order.orderNumber)} — babu's order tracker</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8f4ec; color: #1e2430; line-height: 1.45; }
    .page { max-width: 640px; margin: 0 auto; background: #fff; min-height: 100vh; }
    .banner { width: 100%; display: block; }
    .content { padding: 24px 28px; }
    h1 { font-size: 1.35rem; font-weight: 800; margin-bottom: 4px; }
    .order-num { font-family: ui-monospace, monospace; font-weight: 700; color: #5a46c7; font-size: 0.95rem; margin-bottom: 16px; }
    .card { background: #fdfbf7; border: 1px solid #efe8d8; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
    .label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
    .row { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin: 8px 0; }
    th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: #94a3b8; padding: 8px 12px; border-bottom: 2px solid #efe8d8; }
    .totals { margin-top: 12px; }
    .totals .line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9rem; }
    .grand { font-size: 1.2rem; font-weight: 800; color: #27684b; border-top: 2px solid #c8ebd8; padding-top: 8px; margin-top: 6px; }
    .pay-section { text-align: center; padding: 20px 0; }
    .pay-grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; align-items: flex-start; }
    .pay-card { flex: 0 1 180px; text-align: center; }
    .pay-card img { width: 100%; max-width: 180px; height: auto; border-radius: 12px; border: 2px solid #e2e8f0; background: #fff; }
    .pay-card .pay-label { font-size: 0.75rem; font-weight: 700; margin-top: 6px; color: #334155; }
    .pay-note { font-size: 0.8rem; color: #64748b; margin-top: 12px; }
    .toolbar { position: sticky; top: 0; background: #1e2430; color: #fff; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; align-items: center; z-index: 10; }
    .toolbar-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .toolbar button { background: #725ee0; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 700; font-size: 0.8rem; cursor: pointer; }
    .toolbar button.secondary { background: #475569; }
    .toolbar button.accent { background: #27684b; }
    .toolbar-tip { font-size: 0.75rem; color: #cbd5e1; text-align: center; max-width: 520px; line-height: 1.4; }
    .toolbar-tip strong { color: #fde68a; }
    @media print {
      .toolbar { display: none !important; }
      body { background: #fff; }
      .page { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-row">
      <button class="accent" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button onclick="copyText()">📋 Copy Text Only</button>
      <button class="secondary" onclick="downloadHtml()">⬇️ Download HTML</button>
    </div>
    <p class="toolbar-tip">
      <strong>To email the client:</strong> click <strong>Print / Save as PDF</strong> → choose “Save as PDF” → attach the PDF to your email or Messenger.
      (Email apps can’t paste images from the page directly.)
    </p>
  </div>
  <div class="page">
    <img class="banner" src="${INVOICE_BANNER_TOP}" alt="Order Request" />

    <div class="content">
      <h1>Order Invoice</h1>
      <p class="order-num">#${escapeHTML(order.orderNumber)}</p>

      <div class="card">
        <div class="label">Client</div>
        <div style="font-weight:700;font-size:1.05rem;margin-top:2px;">${escapeHTML(order.fullName)}</div>
        <div style="font-size:0.85rem;color:#475569;margin-top:4px;">${escapeHTML(order.contact)}</div>
        <div style="font-size:0.8rem;color:#725ee0;margin-top:4px;">${escapeHTML(socmedList)}</div>
        <div style="font-size:0.8rem;color:#64748b;margin-top:8px;line-height:1.4;">${escapeHTML(formatFullAddress(order.address))}</div>
      </div>

      <div class="card">
        <div class="label">Items Ordered</div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        <div class="totals">
          <div class="line"><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></div>
          <div class="line"><span>Shipping (${escapeHTML(order.shippingOption)})</span><span>${formatCurrency(order.shippingAmount)}</span></div>
          <div class="line grand"><span>Grand Total</span><span>${formatCurrency(grandTotal)}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="row">
          <div><span class="label">Payment</span><div style="font-weight:700;">${escapeHTML(order.paymentMethod)} · ${order.isPaid ? 'Paid ✓' : 'Unpaid'}</div></div>
          <div style="text-align:right;"><span class="label">Shipped</span><div>${escapeHTML(order.shippedDate || '—')}</div></div>
        </div>
        ${order.shippingDetails ? `<div style="margin-top:10px;font-size:0.8rem;color:#64748b;"><span class="label">Tracking</span><div>${escapeHTML(order.shippingDetails)}</div></div>` : ''}
      </div>

      ${order.isPaid ? `
      <div class="pay-section">
        <div style="display:inline-block;padding:10px 18px;border-radius:999px;background:#e5f5ec;color:#27684b;font-weight:800;font-size:0.95rem;">✓ Payment Received</div>
        <p class="pay-note">No payment QR needed — this order is marked Paid.</p>
      </div>
      ` : `
      <div class="pay-section">
        <div class="label" style="margin-bottom:12px;">Scan to Pay</div>
        <div class="pay-grid">
          <div class="pay-card">
            <img src="${INVOICE_QR_CODE}" alt="GCash / InstaPay QR" />
            <div class="pay-label">GCash · InstaPay</div>
          </div>
          <div class="pay-card">
            <img src="${INVOICE_QR_GOTYME}" alt="GoTyme Bank QR" />
            <div class="pay-label">GoTyme Bank</div>
          </div>
          <div class="pay-card">
            <img src="${INVOICE_QR_MARIBANK}" alt="MariBank QR" />
            <div class="pay-label">MariBank</div>
          </div>
        </div>
        <p class="pay-note">Transfer fees may apply · Use any of the QR codes above</p>
      </div>
      `}
    </div>

    <img class="banner" src="${INVOICE_THANKYOU}" alt="Thank you" />
  </div>

  <script>
    const TEXT_VERSION = ${JSON.stringify(textVersion)};
    function copyText() {
      navigator.clipboard.writeText(TEXT_VERSION).then(() => {
        alert('Invoice text copied to clipboard!');
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = TEXT_VERSION;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Invoice text copied to clipboard!');
      });
    }
    function downloadHtml() {
      // Clone page without the toolbar for a clean email-ready file
      const page = document.querySelector('.page');
      if (!page) return;
      const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${escapeHTML(order.orderNumber)}</title><style>' +
        document.querySelector('style').innerHTML.replace(/\\.toolbar[^{]*\\{[^}]*\\}/g, '') +
        '</style></head><body style="margin:0;background:#f8f4ec;">' + page.outerHTML + '</body></html>';
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice-${escapeHTML(order.orderNumber)}.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Invoice HTML downloaded! Open it and use Print → Save as PDF to attach to email.');
    }
  <\/script>
</body>
</html>
      `);
      win.document.close();
      showToast('Invoice opened in new tab!', 'sage');
    }

    // -------------------------------------------------------------------------
    // 8. CSV EXPORT & OPEN CSV IMPORT
    // -------------------------------------------------------------------------
    const CSV_HEADERS = [
      'Order #',
      'Stage',
      'Full Name',
      'SocMeds',
      'Contact #',
      'House # / Street',
      'Brgy',
      'City',
      'Province',
      'Zip Code',
      'Items Ordered',
      'Subtotal',
      'Shipping Option',
      'Shipping Status',
      'Payment Method',
      'Paid Status',
      'Shipping Amount',
      'Shipped Date',
      'Shipping Details',
      'Delivered Date'
    ];

    function csvEscape(val) {
      const str = val === null || val === undefined ? '' : String(val);
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    function exportToCSV() {
      if (orders.length === 0 && inventory.length === 0) {
        showToast('Nothing to export yet!', 'peach');
        return;
      }

      const rows = [CSV_HEADERS.join(',')];

      orders.forEach(o => {
        const socmedStr = (o.socmeds || [])
          .map(s => `${s.platform}:${s.handle}`)
          .join(' | ');

        const itemsStr = (o.items || [])
          .map(i => `${i.qty}x ${i.name} @${i.price}`)
          .join(' | ');

        const addr = o.address || {};

        const line = [
          o.orderNumber,
          o.stage,
          o.fullName,
          socmedStr,
          o.contact,
          addr.houseStreet || '',
          addr.brgy || '',
          addr.city || '',
          addr.province || '',
          addr.zip || '',
          itemsStr,
          (Number(o.subtotal) || 0).toFixed(2),
          o.shippingOption,
          o.shippingStatus,
          o.paymentMethod,
          o.isPaid ? 'Paid' : 'Unpaid',
          (Number(o.shippingAmount) || 0).toFixed(2),
          o.shippedDate || '',
          o.shippingDetails || '',
          o.deliveredDate || ''
        ].map(csvEscape).join(',');

        rows.push(line);
      });

      // Append inventory section so it travels with the CSV between devices
      rows.push('');
      rows.push('__INVENTORY__');
      rows.push(['Item Name', 'Type', 'Stock', 'Price'].join(','));
      inventory.forEach(item => {
        rows.push([
          item.name,
          item.type || 'merch',
          Number(item.stock) || 0,
          (Number(item.price) || 0).toFixed(2)
        ].map(csvEscape).join(','));
      });

      const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `babus-order-tracker-${getTodayDateStr()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Exported ${orders.length} order(s) + ${inventory.length} inventory item(s)!`, 'sage');
    }

    function triggerCsvUpload() {
      const input = document.getElementById('csvFileInput');
      input.value = '';
      input.click();
    }

    document.getElementById('csvFileInput').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (evt) {
        try {
          const text = evt.target.result;
          const parsed = parseCSVFile(text);
          const parsedOrders = parsed.orders || [];
          const parsedInventory = parsed.inventory || [];

          if (parsedOrders.length === 0 && parsedInventory.length === 0) {
            showToast('No valid orders or inventory found in CSV.', 'peach');
            return;
          }

          const invNote = parsedInventory.length > 0
            ? ` + ${parsedInventory.length} inventory item(s)`
            : '';

          openConfirmDialog({
            title: 'Import from CSV?',
            message: `Found ${parsedOrders.length} order(s)${invNote} in "${file.name}". Replace your current tracker data with this CSV? (Undo is available)`,
            icon: 'folder-open',
            theme: 'primary',
            confirmText: 'Import CSV',
            onConfirm: () => {
              pushHistory(`Open CSV (${parsedOrders.length} orders, ${parsedInventory.length} inv)`);
              if (parsedOrders.length > 0) {
                orders = parsedOrders;
              }
              if (parsedInventory.length > 0) {
                inventory = parsedInventory;
              }
              saveStateToStorage();
              renderTables();
              renderInventoryTable();
              showToast(`Imported ${parsedOrders.length} order(s) + ${parsedInventory.length} inventory item(s)!`, 'sage');
            }
          });
        } catch (err) {
          console.error('CSV Parse Error:', err);
          showToast('Could not parse CSV file. Check formatting.', 'peach');
        }
      };
      reader.readAsText(file);
    });

    function parseCSVRows(csvText) {
      const rows = [];
      let currentRow = [];
      let currentField = '';
      let inQuotes = false;

      const cleanText = csvText.replace(/^\uFEFF/, '');

      for (let i = 0; i < cleanText.length; i++) {
        const ch = cleanText[i];
        const next = cleanText[i + 1];

        if (inQuotes) {
          if (ch === '"' && next === '"') {
            currentField += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            currentField += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            currentRow.push(currentField);
            currentField = '';
          } else if (ch === '\r' && next === '\n') {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            i++;
          } else if (ch === '\n' || ch === '\r') {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
          } else {
            currentField += ch;
          }
        }
      }
      if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
      }
      return rows.filter(r => r.some(cell => cell.trim() !== ''));
    }

    function parseCSVFile(csvText) {
      const matrix = parseCSVRows(csvText);
      if (matrix.length < 1) return { orders: [], inventory: [] };

      // Split into orders section and inventory section at __INVENTORY__ marker
      let invMarkerIdx = -1;
      for (let i = 0; i < matrix.length; i++) {
        const first = (matrix[i][0] || '').trim().toUpperCase();
        if (first === '__INVENTORY__') {
          invMarkerIdx = i;
          break;
        }
      }

      const orderMatrix = invMarkerIdx >= 0 ? matrix.slice(0, invMarkerIdx) : matrix;
      const invMatrix = invMarkerIdx >= 0 ? matrix.slice(invMarkerIdx + 1) : [];

      const orders = parseOrdersFromMatrix(orderMatrix);
      const inventoryItems = parseInventoryFromMatrix(invMatrix);

      return { orders, inventory: inventoryItems };
    }

    function parseOrdersFromMatrix(matrix) {
      if (matrix.length < 2) return [];

      // Skip empty leading rows
      let start = 0;
      while (start < matrix.length && matrix[start].every(c => !String(c || '').trim())) start++;
      if (start >= matrix.length) return [];

      const headers = matrix[start].map(h => h.trim().toLowerCase());
      const colIdx = (names) => headers.findIndex(h => names.some(n => h.includes(n)));

      const iOrderNum = colIdx(['order #', 'order']);
      const iStage = colIdx(['stage']);
      const iName = colIdx(['full name', 'name']);
      const iSocmed = colIdx(['socmed']);
      const iContact = colIdx(['contact']);
      const iHouse = colIdx(['house', 'street']);
      const iBrgy = colIdx(['brgy']);
      const iCity = colIdx(['city']);
      const iProv = colIdx(['province']);
      const iZip = colIdx(['zip']);
      const iItems = colIdx(['items']);
      const iSubtotal = colIdx(['subtotal']);
      const iShipOpt = colIdx(['shipping option']);
      const iShipStat = colIdx(['shipping status']);
      const iPayMethod = colIdx(['payment method']);
      const iPaid = colIdx(['paid']);
      const iShipAmt = colIdx(['shipping amount']);
      const iShipDate = colIdx(['shipped date']);
      const iShipDet = colIdx(['shipping details']);
      const iDelivDate = colIdx(['delivered date']);

      // If this doesn't look like an orders header, skip
      if (iOrderNum < 0 && iName < 0) return [];

      const usedNumbers = new Set();
      const imported = [];

      for (let r = start + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.every(c => !String(c || '').trim())) continue;

        const get = (idx) => (idx >= 0 && idx < row.length ? row[idx].trim() : '');

        // Skip if this is accidentally an inventory header row
        const firstCell = get(0).toLowerCase();
        if (firstCell === 'item name' || firstCell === '__inventory__') continue;

        let orderNum = get(iOrderNum).replace(/^#/, '').trim();
        // Keep existing numeric order #s; only assign a new sequential one if missing/duplicate
        if (!/^\d+$/.test(orderNum) || usedNumbers.has(orderNum) || usedNumbers.has(orderNum.padStart(6, '0'))) {
          let maxNum = 0;
          usedNumbers.forEach(n => {
            const v = parseInt(String(n).replace(/\D/g, ''), 10);
            if (!isNaN(v) && v > maxNum) maxNum = v;
          });
          maxNum += 1;
          orderNum = String(maxNum).padStart(6, '0');
          while (usedNumbers.has(orderNum)) {
            maxNum += 1;
            orderNum = String(maxNum).padStart(6, '0');
          }
        } else {
          orderNum = orderNum.padStart(6, '0');
        }
        usedNumbers.add(orderNum);

        const rawStage = get(iStage).toLowerCase();
        const stage = ['ongoing', 'shipping', 'completed'].includes(rawStage) ? rawStage : 'ongoing';

        const socmeds = get(iSocmed)
          ? get(iSocmed).split('|').map(part => {
              const trimmed = part.trim();
              const colonPos = trimmed.indexOf(':');
              if (colonPos > 0) {
                return {
                  platform: trimmed.slice(0, colonPos).trim(),
                  handle: trimmed.slice(colonPos + 1).trim()
                };
              }
              return { platform: 'Social', handle: trimmed };
            }).filter(s => s.handle)
          : [];

        const items = get(iItems)
          ? get(iItems).split('|').map(part => {
              const trimmed = part.trim();
              const match = trimmed.match(/^(\d+)x\s+(.+?)(?:\s+@([\d.]+))?$/i);
              if (match) {
                return {
                  qty: parseInt(match[1], 10) || 1,
                  name: match[2].trim(),
                  price: parseFloat(match[3]) || 0
                };
              }
              return { qty: 1, name: trimmed, price: 0 };
            }).filter(i => i.name)
          : [];

        const paidStr = get(iPaid).toLowerCase();
        const isPaid = paidStr === 'paid' || paidStr === 'true' || paidStr === 'yes' || paidStr === '1';

        imported.push({
          id: generateUUID(),
          orderNumber: orderNum,
          fullName: get(iName) || 'Unnamed Client',
          socmeds,
          contact: get(iContact),
          address: {
            houseStreet: get(iHouse),
            brgy: get(iBrgy),
            city: get(iCity),
            province: get(iProv),
            zip: get(iZip)
          },
          items,
          subtotal: parseFloat(get(iSubtotal)) || 0,
          shippingOption: get(iShipOpt) || 'J&T Express',
          shippingStatus: get(iShipStat) || 'Preparing',
          paymentMethod: get(iPayMethod) || 'G-Cash',
          isPaid,
          stage,
          shippingAmount: parseFloat(get(iShipAmt)) || 0,
          shippedDate: get(iShipDate),
          shippingDetails: get(iShipDet),
          deliveredDate: get(iDelivDate),
          createdAt: new Date().toISOString()
        });
      }

      return imported;
    }

    function parseInventoryFromMatrix(matrix) {
      if (!matrix || matrix.length < 1) return [];

      let start = 0;
      while (start < matrix.length && matrix[start].every(c => !String(c || '').trim())) start++;
      if (start >= matrix.length) return [];

      const headers = matrix[start].map(h => String(h || '').trim().toLowerCase());
      const looksLikeHeader = headers.some(h => h.includes('item') || h.includes('name') || h.includes('stock') || h.includes('price'));

      let iName = headers.findIndex(h => h.includes('item') || h === 'name' || h.includes('name'));
      let iType = headers.findIndex(h => h === 'type' || h.includes('type'));
      let iStock = headers.findIndex(h => h.includes('stock') || h.includes('qty') || h.includes('quantity'));
      let iPrice = headers.findIndex(h => h.includes('price') || h.includes('amount'));

      // Fallback column positions if header detection fails
      if (iName < 0) iName = 0;
      if (iType < 0) iType = 1;
      if (iStock < 0) iStock = 2;
      if (iPrice < 0) iPrice = 3;

      const dataStart = looksLikeHeader ? start + 1 : start;
      const imported = [];

      for (let r = dataStart; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.every(c => !String(c || '').trim())) continue;

        const get = (idx) => (idx >= 0 && idx < row.length ? String(row[idx]).trim() : '');
        const name = get(iName);
        if (!name || name.toLowerCase() === 'item name') continue;

        const rawType = get(iType).toLowerCase();
        const type = rawType === 'commission' ? 'commission' : 'merch';

        imported.push({
          id: 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
          name,
          type,
          stock: type === 'commission' ? 0 : (parseInt(get(iStock), 10) || 0),
          price: parseFloat(get(iPrice)) || 0,
          createdAt: new Date().toISOString()
        });
      }

      return imported;
    }

    // -------------------------------------------------------------------------
    // 9. UNIVERSAL CUSTOM CONFIRMATION MODAL & TOASTS
    // -------------------------------------------------------------------------
    let pendingConfirmCallback = null;

    function openConfirmDialog({ title, message, icon = 'help-circle', theme = 'primary', confirmText = 'Confirm', onConfirm }) {
      const modal = document.getElementById('confirmDialogModal');
      const iconWrap = document.getElementById('confirmDialogIconWrap');
      const iconEl = document.getElementById('confirmDialogIcon');
      const okBtn = document.getElementById('confirmDialogOkBtn');

      document.getElementById('confirmDialogTitle').textContent = title;
      document.getElementById('confirmDialogMessage').textContent = message;
      okBtn.textContent = confirmText;
      iconEl.setAttribute('data-lucide', icon);

      if (theme === 'danger') {
        iconWrap.className = 'w-14 h-14 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4';
        okBtn.className = 'btn-trendy flex-1 py-2.5 px-4 rounded-xl text-sm font-extrabold bg-rose-600 text-white shadow-tactile hover:bg-rose-700';
      } else if (theme === 'sage') {
        iconWrap.className = 'w-14 h-14 mx-auto rounded-2xl bg-sage-100 text-sage-600 flex items-center justify-center mb-4';
        okBtn.className = 'btn-trendy flex-1 py-2.5 px-4 rounded-xl text-sm font-extrabold bg-sage-600 text-white shadow-tactile-sage hover:bg-sage-700';
      } else {
        iconWrap.className = 'w-14 h-14 mx-auto rounded-2xl bg-lavender-100 text-lavender-600 flex items-center justify-center mb-4';
        okBtn.className = 'btn-trendy flex-1 py-2.5 px-4 rounded-xl text-sm font-extrabold bg-lavender-600 text-white shadow-tactile-primary hover:bg-lavender-500';
      }

      pendingConfirmCallback = onConfirm;
      okBtn.onclick = () => {
        const cb = pendingConfirmCallback;
        closeConfirmDialog();
        if (typeof cb === 'function') cb();
      };

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      lucide.createIcons();
    }

    function closeConfirmDialog() {
      const modal = document.getElementById('confirmDialogModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      pendingConfirmCallback = null;
    }

    function showToast(message, color = 'lavender') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');

      const styles = {
        lavender: 'bg-slate-900 text-white border-lavender-500',
        sage: 'bg-sage-700 text-white border-sage-400',
        peach: 'bg-peach-600 text-white border-peach-300',
        amber: 'bg-amber-600 text-white border-amber-300'
      };

      toast.className = `pointer-events-auto px-4 py-2.5 rounded-2xl shadow-lg border text-xs sm:text-sm font-bold flex items-center gap-2 animate-pop-in ${styles[color] || styles.lavender}`;
      toast.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 shrink-0"></i><span>${escapeHTML(message)}</span>`;

      container.appendChild(toast);
      lucide.createIcons();

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.2s ease';
        setTimeout(() => toast.remove(), 220);
      }, 2800);
    }

    // -------------------------------------------------------------------------
    // 10. BABU'S INVENTORY MANAGEMENT
    // -------------------------------------------------------------------------
    function openInventoryModal() {
      resetInventoryForm();
      renderInventoryTable();
      const modal = document.getElementById('inventoryModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      lucide.createIcons();
    }

    function closeInventoryModal() {
      const modal = document.getElementById('inventoryModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      // Refresh any open order form item rows' datalists / stock displays
      document.querySelectorAll('#itemsContainer .item-row .item-name').forEach(input => {
        onItemNameInput(input);
      });
    }

    function resetInventoryForm() {
      document.getElementById('inventoryForm').reset();
      document.getElementById('editInventoryId').value = '';
      document.getElementById('invFieldStock').value = '0';
      document.getElementById('invFieldPrice').value = '0';
      document.getElementById('invSubmitText').textContent = 'Add Item';
      document.getElementById('invCancelEditBtn').classList.add('hidden');
    }

    function renderInventoryTable() {
      const tbody = document.getElementById('tbody-inventory');
      const empty = document.getElementById('empty-inventory');
      const badge = document.getElementById('inventoryCountBadge');
      const summary = document.getElementById('inventorySummaryText');

      if (badge) badge.textContent = inventory.length;
      if (summary) {
        const totalStock = inventory.reduce((s, i) => s + (Number(i.stock) || 0), 0);
        summary.textContent = `${inventory.length} item${inventory.length === 1 ? '' : 's'} · ${totalStock} total stock`;
      }

      if (!tbody) return;

      if (inventory.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }
      if (empty) empty.classList.add('hidden');

      // Sort by name
      const sorted = [...inventory].sort((a, b) => a.name.localeCompare(b.name));

      tbody.innerHTML = sorted.map(item => {
        const isComm = item.type === 'commission';
        const stockClass = isComm
          ? 'bg-lavender-100 text-lavender-700 border-lavender-200'
          : (item.stock <= 0
            ? 'bg-rose-100 text-rose-700 border-rose-200'
            : (item.stock <= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-sage-100 text-sage-700 border-sage-200'));
        return `
          <tr class="hover:bg-lavender-50/40 transition-colors">
            <td class="py-3 px-4">
              <p class="font-bold text-slate-900">${escapeHTML(item.name)}</p>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${isComm ? 'bg-lavender-50 text-lavender-700 border-lavender-200' : 'bg-cream-100 text-slate-700 border-cream-200'}">
                ${isComm ? 'Commission' : 'Merch'}
              </span>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${stockClass}">
                ${isComm ? '∞' : item.stock}
              </span>
            </td>
            <td class="py-3 px-4 text-right">
              <span class="font-display font-extrabold text-slate-900">${formatCurrency(item.price)}</span>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="inline-flex items-center justify-end gap-1.5">
                <button type="button" onclick="editInventoryItem('${item.id}')" title="Edit"
                  class="btn-trendy p-2 rounded-xl bg-white text-slate-700 border border-slate-200 shadow-tactile hover:bg-cream-100">
                  <i data-lucide="pencil" class="w-3.5 h-3.5 text-lavender-600"></i>
                </button>
                <button type="button" onclick="requestDeleteInventoryItem('${item.id}')" title="Delete"
                  class="btn-trendy p-2 rounded-xl bg-white text-rose-600 border border-slate-200 shadow-tactile hover:bg-rose-50">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      lucide.createIcons();
    }

    function handleInventoryFormSubmit(e) {
      e.preventDefault();
      const editId = document.getElementById('editInventoryId').value;
      const name = document.getElementById('invFieldName').value.trim();
      const type = document.getElementById('invFieldType')?.value || 'merch';
      const stock = type === 'commission' ? 0 : (parseInt(document.getElementById('invFieldStock').value, 10) || 0);
      const price = parseFloat(document.getElementById('invFieldPrice').value) || 0;

      if (!name) {
        showToast('Item name is required.', 'peach');
        return;
      }

      const nameExists = inventory.some(i =>
        i.name.toLowerCase() === name.toLowerCase() && i.id !== editId
      );
      if (nameExists) {
        showToast('An item with this name already exists.', 'peach');
        return;
      }

      if (editId) {
        pushHistory(`Edit inventory: ${name}`);
        const idx = inventory.findIndex(i => i.id === editId);
        if (idx !== -1) {
          inventory[idx] = { ...inventory[idx], name, stock, price, type };
        }
        showToast(`Updated "${name}" in inventory.`, 'sage');
      } else {
        pushHistory(`Add inventory: ${name}`);
        inventory.push({
          id: 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
          name,
          stock,
          price,
          type,
          createdAt: new Date().toISOString()
        });
        showToast(`Added "${name}" to inventory.`, 'sage');
      }

      saveStateToStorage();
      resetInventoryForm();
      renderInventoryTable();
    }

    function editInventoryItem(id) {
      const item = inventory.find(i => i.id === id);
      if (!item) return;
      document.getElementById('editInventoryId').value = item.id;
      document.getElementById('invFieldName').value = item.name;
      document.getElementById('invFieldStock').value = item.stock;
      document.getElementById('invFieldPrice').value = Number(item.price).toFixed(2);
      const typeEl = document.getElementById('invFieldType');
      if (typeEl) typeEl.value = item.type || 'merch';
      document.getElementById('invSubmitText').textContent = 'Save Changes';
      document.getElementById('invCancelEditBtn').classList.remove('hidden');
      document.getElementById('invFieldName').focus();
    }

    function requestDeleteInventoryItem(id) {
      const item = inventory.find(i => i.id === id);
      if (!item) return;
      openConfirmDialog({
        title: `Delete "${item.name}"?`,
        message: `Remove this item from babu's inventory? Existing orders are not affected.`,
        icon: 'trash-2',
        theme: 'danger',
        confirmText: 'Delete Item',
        onConfirm: () => {
          pushHistory(`Delete inventory: ${item.name}`);
          inventory = inventory.filter(i => i.id !== id);
          saveStateToStorage();
          renderInventoryTable();
          showToast(`Removed "${item.name}" from inventory.`, 'peach');
        }
      });
    }

    // When saving a new order, auto-add new items to inventory and deduct stock for known items
    function syncInventoryFromOrderItems(items, isNewOrder) {
      if (!items || items.length === 0) return;

      items.forEach(item => {
        const name = (item.name || '').trim();
        if (!name) return;
        const type = item.type || 'merch';
        // Digital commissions do not affect physical stock
        if (type === 'commission') return;

        const qty = parseInt(item.qty, 10) || 1;
        const price = parseFloat(item.price) || 0;

        const existing = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (isNewOrder) {
            existing.stock = Math.max(0, (Number(existing.stock) || 0) - qty);
          }
        } else if (isNewOrder) {
          inventory.push({
            id: 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
            name,
            stock: 0,
            price,
            type: 'merch',
            createdAt: new Date().toISOString()
          });
        }
      });
    }

    // Put stock back when an ongoing/shipping order is deleted (merch only)
    function restoreInventoryFromOrderItems(items) {
      if (!items || items.length === 0) return;

      items.forEach(item => {
        const name = (item.name || '').trim();
        if (!name) return;
        const type = item.type || 'merch';
        if (type === 'commission') return;

        const qty = parseInt(item.qty, 10) || 1;
        const price = parseFloat(item.price) || 0;

        const existing = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.stock = (Number(existing.stock) || 0) + qty;
        } else {
          inventory.push({
            id: 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
            name,
            stock: qty,
            price,
            type: 'merch',
            createdAt: new Date().toISOString()
          });
        }
      });
    }

    // Dark mode
    function toggleDarkMode() {
      const root = document.documentElement;
      const isDark = root.classList.toggle('dark');
      try { localStorage.setItem('babus_dark_mode', isDark ? '1' : '0'); } catch (_) {}
      updateDarkModeButton(isDark);
      lucide.createIcons();
    }

    function updateDarkModeButton(isDark) {
      const icon = document.getElementById('darkModeIcon');
      const label = document.getElementById('darkModeLabel');
      if (icon) icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      if (label) label.textContent = isDark ? 'Light' : 'Dark';
    }

    function initDarkMode() {
      let isDark = false;
      try { isDark = localStorage.getItem('babus_dark_mode') === '1'; } catch (_) {}
      if (isDark) document.documentElement.classList.add('dark');
      updateDarkModeButton(isDark);
    }

    // Initialize Application
    window.addEventListener('DOMContentLoaded', () => {
      initDarkMode();
      loadState();
      lucide.createIcons();
    });
