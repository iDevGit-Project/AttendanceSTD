// students.restore.toggle.js
(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const toggleBtn = document.getElementById("toggleInactiveBtn");
        if (!toggleBtn) {
            console.error("toggleInactiveBtn not found in DOM!");
            return;
        }

        // تنظیمات اولیه (قابل تغییر در صورت نیاز)
        let showInactive = false; // حالت فعلی (false => نمایش فعال‌ها)
        let currentPage = 1;
        let pageSize = (document.getElementById('studentsPageSize') ? parseInt(document.getElementById('studentsPageSize').value, 10) : 50);
        const searchEl = document.getElementById('studentSearchInput');

        // تابع کمکی: پیدا کردن tbody (fallbacks)
        function getTbody() {
            return document.getElementById('students-table-body') ||
                document.querySelector('#studentsTable tbody') ||
                document.querySelector('table tbody');
        }

        // تابع سازنده HTML ردیف (حفظ دیتا-اتربیوت‌ها برای مودال‌ها و دکمه‌ها)
        function buildRowHtml(s) {
            // s: { id, firstName, lastName, fatherName, nationalCode, grade, schoolName, coachName, photo, inactiveReason, isActive, className }
            const photo = s.photo || "/uploads/students/default.png";
            const isActive = !!s.isActive;
            const trClass = isActive ? '' : 'bg-rose-50 text-rose-700';
            const statusHtml = isActive
                ? `<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>`
                : `<span class="inline-block px-2 py-1 font-bold text-sm text-rose-800 bg-rose-100 rounded">غیرفعال</span>`;
            const inactReason = (!isActive && s.inactiveReason) ? `<div class="max-w-xs mx-auto break-words text-sm text-pink-800 bg-pink-100 px-2 py-1 rounded">${escapeHtml(s.inactiveReason)}</div>` : `<span class="text-slate-400">داده ثبت نشده</span>`;

            return `
<tr id="row-${s.id}" data-student-id="${s.id}" class="border-b hover:bg-blue-50/50 ${trClass}">
  <td class="px-2 py-1 align-middle">
    <img src="${escapeAttr(photo)}" alt="عکس ${escapeAttr(s.firstName)} ${escapeAttr(s.lastName)}" class="w-10 h-10 object-cover rounded-full border" />
  </td>
  <td class="px-2 py-1 text-sm align-middle">${escapeHtml(s.firstName)}</td>
  <td class="px-2 py-1 text-sm align-middle">${escapeHtml(s.lastName)}</td>
  <td class="px-2 py-1 text-sm align-middle">${escapeHtml(s.nationalCode || '')}</td>
  <td class="px-2 py-1 text-sm align-middle">${escapeHtml(s.grade || '')}</td>
  <td class="px-2 py-1 text-sm align-middle">${escapeHtml(s.schoolName || '')}</td>
  <td class="px-2 py-1 text-sm align-middle">${escapeHtml(s.coachName || '')}</td>
  <td class="px-2 py-1 text-sm align-middle text-center">${statusHtml}</td>
  <td class="px-2 py-1 text-sm align-middle space-x-1 rtl:space-x-reverse">
    <button type="button"
            class="open-view-modal inline-block bg-slate-100 text-slate-800 px-2 py-1 text-sm rounded hover:bg-blue-200 font-bold transition"
            data-id="${s.id}"
            data-firstname="${escapeAttr(s.firstName)}"
            data-lastname="${escapeAttr(s.lastName)}"
            data-fathername="${escapeAttr(s.fatherName || '')}"
            data-school="${escapeAttr(s.schoolName || '')}"
            data-grade="${escapeAttr(s.grade || '')}"
            data-coach="${escapeAttr(s.coachName || '')}"
            data-nationalcode="${escapeAttr(s.nationalCode || '')}"
            data-photo="${escapeAttr(photo)}"
            data-class="${escapeAttr(s.className || '')}"
            data-isactive="${isActive}"
            data-inactivereason="${escapeAttr(s.inactiveReason || '')}">
      جزئیات
    </button>

    ${isActive ? `
      <button type="button"
              class="open-edit-student inline-block bg-slate-100 text-amber-500 px-2 py-1 rounded text-sm  hover:bg-amber-100 font-bold transition"
              data-id="${s.id}">
        ویرایش
      </button>

      <button type="button"
              class="student-delete-modal inline-block bg-slate-100 text-rose-600 px-2 py-1 rounded text-sm hover:bg-rose-100 font-bold transition"
              data-id="${s.id}"
              data-name="${escapeAttr(s.firstName + ' ' + s.lastName)}">
        غیرفعال
      </button>
    ` : `
      <button type="button"
              class="open-restore-modal inline-block bg-slate-100 text-teal-500 px-2 py-1 rounded text-sm hover:bg-teal-100 font-bold transition hidden"
              data-id="${s.id}">
        فعالسازی
      </button>
    `}

    <button type="button"
            class="open-hard-delete-modal inline-block bg-pink-600 text-slate-100 px-2 py-1 rounded text-sm hover:bg-pink-800 transition"
            data-id="${s.id}"
            title="حذف دائمی اطلاعات دانش آموز">
      حذف دائم
    </button>
  </td>

  <td class="px-2 py-1 text-sm align-middle">
    ${inactReason}
  </td>
</tr>`;
        }

        // توابع کمکی برای جلوگیری از XSS در innerHTML
        function escapeHtml(s) {
            if (s === null || s === undefined) return '';
            return String(s)
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;');
        }
        function escapeAttr(s) {
            if (s === null || s === undefined) return '';
            return String(s)
                .replaceAll('&', '&amp;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;');
        }

        // تابع اصلی: گرفتن داده‌ها و جایگزینی tbody
        async function loadAndRender(page = 1) {
            currentPage = page;
            const q = (searchEl && searchEl.value) ? encodeURIComponent(searchEl.value.trim()) : '';
            const url = `/Students/ListPaged?showInactive=${showInactive}&page=${currentPage}&pageSize=${pageSize}&search=${q}`;

            try {
                const res = await fetch(url, { credentials: 'same-origin' });
                if (!res.ok) {
                    console.error('ListPaged fetch failed', res.status);
                    return;
                }
                const json = await res.json();
                const students = json.students || [];
                const tbody = getTbody();
                if (!tbody) {
                    console.error('students tbody not found');
                    return;
                }

                // بساز و جایگزین کن (حفظ ترتیب ستون‌ها طبق Partial شما)
                tbody.innerHTML = students.map(s => buildRowHtml(s)).join('');

                // آپدیت UI: شمارش، صفحه جاری و دکمه toggle
                const inactiveCountEl = document.getElementById('studentsInactiveCount');
                if (inactiveCountEl && typeof json.inactiveCount !== 'undefined') inactiveCountEl.textContent = json.inactiveCount;

                const totalCountEl = document.getElementById('studentsTotalCount');
                if (totalCountEl && typeof json.totalCount !== 'undefined') totalCountEl.textContent = json.totalCount;

                // بروزرسانی متن دکمه toggle
                if (showInactive) {
                    toggleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    toggleBtn.textContent = `نمایش رکوردهای فعال (${json.totalCount || 0})`;
                    // علامت دهی اینکه الان داریم غیرفعال‌ها رو نمایش میدیم
                    toggleBtn.dataset.showInactive = 'true';
                } else {
                    toggleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    toggleBtn.textContent = `نمایش رکوردهای غیرفعال (${json.inactiveCount || 0})`;
                    toggleBtn.dataset.showInactive = 'false';
                }

                // رویداد سفارشی برای اتصال بقیهٔ کدها (مثلاً bindAjaxForm یا event delegation)
                document.dispatchEvent(new CustomEvent('students:contentUpdated', { detail: { students, json } }));
            } catch (err) {
                console.error('Error loading students:', err);
            }
        }

        // کلیک روی دکمه toggle
        toggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            showInactive = !showInactive;
            // اگر می‌خواهی روی کلیک صفحه reload شود به جای AJAX، می‌توانی
            // window.location.href = `@Url.Action("Index", "Students")?showInactive=${showInactive}`;
            loadAndRender(1);
        });

        // اگر صفحه دارای pagination controls است، می‌توانیم گوش بدهیم به event سفارشی برای جابجایی صفحات:
        document.addEventListener('students:gotoPage', function (ev) {
            const p = ev?.detail?.page || 1;
            loadAndRender(p);
        });

        // بار اول: مقدار اولیه toggle را از ViewBag یا attribute بخوان (اگر وجود دارد)
        try {
            const vb = (typeof pageShowInactive !== 'undefined') ? (pageShowInactive === true || pageShowInactive === 'true') : false;
            showInactive = vb;
        } catch (e) { /* ignore */ }

        // بار اول بارگذاری جدول
        loadAndRender(currentPage);

    }); // DOMContentLoaded end
    // Function: replaceDetailsWithActivateBtn
    function replaceDetailsWithActivateBtn(student) {
        try {
            if (!student || !student.id) return console.warn('invalid student for replace', student);
            const row = document.querySelector(`tr[data-student-id='${student.id}']`) || document.getElementById('row-' + student.id);
            if (!row) return console.warn('row not found for student id', student.id);

            // update status cell (try multiple indices, safer: find the cell that contains 'فعال' or 'غیرفعال')
            let statusCell = row.querySelector('td:nth-child(8)');
            // fallback: find first td that contains class-indicator text
            if (!statusCell) {
                const tds = Array.from(row.querySelectorAll('td'));
                statusCell = tds.find(td => /فعال|غیرفعال/.test(td.textContent)) || tds[tds.length - 2];
            }
            if (statusCell) {
                statusCell.innerHTML = `<span class="inline-block px-2 py-1 font-bold text-sm text-teal-800 bg-teal-100 rounded">فعال</span>`;
            }

            // find the actions cell (commonly the second-to-last or third-to-last column)
            let actionsCell = row.querySelector('td:nth-last-child(2)') || row.querySelector('td:nth-child(9)') || row.querySelector('td:last-child');
            if (!actionsCell) actionsCell = row.querySelector('td');

            // Find the "جزئیات" button more robustly: by class, by attribute data-id + first button text, or by innerText
            let detailsBtn = null;
            // try known class
            detailsBtn = row.querySelector('.open-view-modal') || row.querySelector('button.open-view-modal') || row.querySelector('a.open-view-modal');
            // try button whose text contains 'جزئیات'
            if (!detailsBtn) {
                const candidates = Array.from(row.querySelectorAll('button, a'));
                detailsBtn = candidates.find(el => (el.textContent || '').trim().includes('جزئیات'));
            }
            // try first button in actionsCell
            if (!detailsBtn && actionsCell) {
                detailsBtn = actionsCell.querySelector('button, a');
            }

            // build activate button html
            const activateHtml = `<button type="button" class="open-activate-button inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-sm font-bold transition" data-id="${student.id}" title="فعالسازی">فعال‌سازی</button>`;

            if (detailsBtn) {
                const parentTd = detailsBtn.closest('td') || actionsCell;
                // replace only that button
                detailsBtn.insertAdjacentHTML('afterend', activateHtml);
                detailsBtn.remove();
            } else if (actionsCell) {
                actionsCell.insertAdjacentHTML('afterbegin', activateHtml);
            } else {
                console.warn('cannot find place to insert activate button for row', student.id);
            }

            // ensure other action buttons visibility
            if (actionsCell) {
                if (student.isActive === true || String(student.isActive) === 'true') {
                    actionsCell.querySelectorAll('.open-edit-student, .student-delete-modal').forEach(el => el.classList.remove('hidden'));
                    actionsCell.querySelectorAll('.open-restore-modal').forEach(el => el.classList.add('hidden'));
                } else {
                    actionsCell.querySelectorAll('.open-edit-student, .student-delete-modal').forEach(el => el.classList.add('hidden'));
                    actionsCell.querySelectorAll('.open-restore-modal').forEach(el => el.classList.remove('hidden'));
                }
            }

            // attach handler to new button (non-destructive, only for UX)
            const newBtn = row.querySelector('.open-activate-button');
            if (newBtn) {
                newBtn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    showNotify(`دانش‌آموز ${student.firstName || ''} ${student.lastName || ''} فعال است.`, 'success');
                });
            }

            console.log('replaceDetailsWithActivateBtn applied for', student.id);
        } catch (err) {
            console.error('replaceDetailsWithActivateBtn error:', err);
        }
    }


})();
