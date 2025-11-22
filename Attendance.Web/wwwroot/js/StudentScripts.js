(function () {
    // =========================
    // Gregorian -> Jalali (Persian) conversion
    // =========================
    function toJalaali(g_y, g_m, g_d) {
        var g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

        var gy = g_y - 1600;
        var gm = g_m - 1;
        var gd = g_d - 1;

        var g_day_no = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);
        for (var i = 0; i < gm; ++i) g_day_no += g_days_in_month[i];
        if (gm > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) g_day_no++;
        g_day_no += gd;

        var j_day_no = g_day_no - 79;
        var j_np = Math.floor(j_day_no / 12053);
        j_day_no = j_day_no % 12053;

        var jy = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
        j_day_no %= 1461;

        if (j_day_no >= 366) {
            jy += Math.floor((j_day_no - 366) / 365);
            j_day_no = (j_day_no - 366) % 365;
        }

        var jm = 0;
        for (var i = 0; i < 11 && j_day_no >= j_days_in_month[i]; ++i) {
            j_day_no -= j_days_in_month[i];
            jm = i + 1;
        }
        var jd = j_day_no + 1;
        return [jy, jm + 1, jd];
    }

    function pad2(v) { return v < 10 ? '0' + v : '' + v; }

    function formatToJalaliWithTime(dateInput) {
        if (!dateInput) return '';
        var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        var gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
        var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
        var j = toJalaali(gy, gm, gd);
        var jy = j[0], jm = j[1], jd = j[2];
        return `${jy}/${pad2(jm)}/${pad2(jd)} ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    }

    function formatToJalaliDate(dateInput) {
        if (!dateInput) return '';
        var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        var j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return `${j[0]}/${pad2(j[1])}/${pad2(j[2])}`;
    }

    // =========================
    // URLs & page variables
    // =========================
    const inactiveCountUrl = '@Url.Action("InactiveCount", "Students")';
    const listPagedUrl = '@Url.Action("ListPaged", "Students")';
    const restorePartialUrl = '@Url.Action("RestorePartial", "Students")';
    const restorePartialConfirmedUrl = '@Url.Action("RestorePartialConfirmed", "Students")';
    const editPartialUrlBase = '@Url.Action("EditPartial", "Students")';
    const deletePartialUrlBase = '@Url.Action("DeletePartial", "Students")';
    const showInactiveTrueUrl = '@Url.Action("Index", new { showInactive = true })';
    const showInactiveFalseUrl = '@Url.Action("Index", new { showInactive = false })';
    const pageShowInactive = @(ViewBag.ShowInactive == true ? "true" : "false");
    let currentPage = @(ViewBag.CurrentPage ?? 1);
    let defaultPageSize = @(ViewBag.PageSize ?? 50);

    // =========================
    // Tailwind toast notifications
    // =========================
    function ensureToastContainer() {
        let c = document.getElementById('toastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastContainer';
            c.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 z-60 space-y-2 w-full max-w-lg px-4 pointer-events-none';
            c.setAttribute('dir', 'ltr');
            document.body.appendChild(c);
        }
        return c;
    }

    function showNotify(message, type = 'info', duration = 3500) {
        const container = ensureToastContainer();
        const id = 'notify-' + Date.now();
        const bg = type === 'success' ? 'bg-emerald-600' : (type === 'warning' ? 'bg-amber-600' : (type === 'error' ? 'bg-rose-600' : 'bg-sky-600'));
        const icon = type === 'success' ? '✔' : (type === 'warning' ? '⚠' : (type === 'error' ? '✖' : 'ℹ'));
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `pointer-events-auto w-full ${bg} text-white rounded-md shadow-lg px-4 py-3 flex items-center gap-3 transform transition duration-300 ease-out`;
        toast.style.opacity = '0';
        toast.style.marginBottom = '0.5rem';
        toast.innerHTML = `
                    <div class="text-lg">${icon}</div>
                    <div class="flex-1 text-sm leading-5 text-right">${message}</div>
                    <button class="ml-3 text-white/80 hover:text-white" data-dismiss="${id}" aria-label="بستن اعلان">✕</button>
                `;
        container.prepend(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
        toast.querySelector('[data-dismiss]')?.addEventListener('click', () => closeNotify(id));
        setTimeout(() => closeNotify(id), duration);

        function closeNotify(idToClose) {
            const t = document.getElementById(idToClose);
            if (!t) return;
            t.style.opacity = '0';
            t.style.transform = 'translateY(-10px)';
            setTimeout(() => t.remove(), 300);
        }
    }

    // =========================
    // Helpers
    // =========================
    function escAttr(s) { if (s === null || s === undefined) return ''; return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function findRowById(id) {
        if (id === null || typeof id === 'undefined') return null;
        const selectors = [
            `button.open-edit-modal[data-id='${id}']`,
            `button.open-delete-modal[data-id='${id}']`,
            `button.open-restore-modal[data-id='${id}']`,
            `button.open-student-modal[data-id='${id}']`
        ];
        for (const s of selectors) {
            const btn = document.querySelector(s);
            if (btn) return btn.closest('tr');
        }
        return document.querySelector(`tr[data-student-id='${id}']`) || document.getElementById('row-' + id);
    }

    function updateRowWithStudent(student, assumeActive) {
        const oldRow = document.getElementById('row-' + student.id);
        if (!oldRow) {
            // اگر ردیف وجود ندارد، بازسازی صفحه جاری امن‌ترین گزینه است
            rebuildTableBodyFromServerPaged(currentPage, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || ''));
            return;
        }

        const newRowHtml = buildRowHtmlFromData(student);
        const wrapper = document.createElement('tbody');
        wrapper.innerHTML = newRowHtml;
        const newTr = wrapper.querySelector('tr');
        if (newTr) oldRow.replaceWith(newTr);
    }

    // =========================
    // Modal detail (مشاهده)
    // =========================
    const backdropDetail = document.getElementById('studentModalBackdrop') || document.getElementById('studentDetailBackdrop');
    const modalDetail = document.getElementById('studentModal') || document.getElementById('studentDetailModal');
    const closeBtnDetail = document.getElementById('modalCloseBtn') || document.getElementById('closeStudentDetailBtn');
    const closeFooterDetail = document.getElementById('modalCloseFooter') || document.getElementById('closeStudentDetailFooterBtn');

    const modalPhoto = document.getElementById('modalPhoto');
    const modalName = document.getElementById('modalName');
    const modalFirstName = document.getElementById('modalFirstName');
    const modalLastName = document.getElementById('modalLastName');
    const modalFatherName = document.getElementById('modalFatherName');
    const modalNationalCode = document.getElementById('modalNationalCode');
    const modalGrade = document.getElementById('modalGrade');
    const modalCoach = document.getElementById('modalCoach');
    const modalSchool = document.getElementById('modalSchool');
    const modalId = document.getElementById('modalId');
    const modalEditLink = document.getElementById('modalEditLink');
    const modalSubTitle = document.getElementById('modalSubTitle');

    function openDetailFromDataset(dataset) {
        const id = dataset.id || '';
        const firstname = dataset.firstname || '';
        const lastname = dataset.lastname || '';
        const fathername = dataset.fathername || '';
        const school = dataset.school || '';
        const grade = dataset.grade || '';
        const coach = dataset.coach || '';
        const nationalcode = dataset.nationalcode || '';
        const photo = dataset.photo || '/uploads/students/default.png';
        const className = dataset.class || '';

        if (modalPhoto) modalPhoto.src = photo;
        if (modalName) modalName.textContent = firstname + ' ' + lastname;
        if (modalFirstName) modalFirstName.textContent = firstname;
        if (modalLastName) modalLastName.textContent = lastname;
        if (modalFatherName) modalFatherName.textContent = fathername;
        if (modalNationalCode) modalNationalCode.textContent = nationalcode;
        if (modalGrade) modalGrade.textContent = grade;
        if (modalCoach) modalCoach.textContent = coach;
        if (modalSchool) modalSchool.textContent = school;
        if (modalId) modalId.textContent = id;
        if (modalSubTitle) modalSubTitle.textContent = className ? `کلاس: ${className}` : '';
        if (modalEditLink) modalEditLink.href = `/Students/Edit/${id}`;

        backdropDetail?.classList.remove('hidden');
        modalDetail?.classList.remove('hidden');

        setTimeout(() => {
            modalDetail?.querySelector('div')?.focus?.();
        }, 100);
    }

    function closeDetailModal() {
        backdropDetail?.classList.add('hidden');
        modalDetail?.classList.add('hidden');
    }

    document.addEventListener('click', function (e) {
        const viewBtn = e.target.closest('.open-student-modal');
        if (viewBtn) {
            openDetailFromDataset(viewBtn.dataset);
            return;
        }
    });

    if (closeBtnDetail) closeBtnDetail.addEventListener('click', closeDetailModal);
    if (closeFooterDetail) closeFooterDetail.addEventListener('click', closeDetailModal);
    if (backdropDetail) backdropDetail.addEventListener('click', closeDetailModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetailModal(); });

    // =========================
    // AJAX modal (Edit/Delete/Restore)
    // =========================
    const backdropAjax = document.getElementById('modalBackdropAjax') || document.getElementById('ajaxBackdrop');
    const ajasmodal = document.getElementById('ajasmodal') || document.getElementById('ajasmodalContainer');
    const modalContentAjax = document.getElementById('modalContentAjax') || document.getElementById('ajasmodalContainer');

    function showAjasmodal() {
        if (backdropAjax) backdropAjax.classList.remove('hidden');
        if (ajasmodal) ajasmodal.classList.remove('hidden');
    }
    function closeAjasmodal() {
        if (backdropAjax) backdropAjax.classList.add('hidden');
        if (ajasmodal) ajasmodal.classList.add('hidden');
        if (modalContentAjax) modalContentAjax.innerHTML = '';
    }

    function expectedFormIdForUrl(url) {
        if (!url) return null;
        if (url.includes('EditPartial')) return 'editStudentForm';
        if (url.includes('DeletePartial')) return 'deleteStudentForm';
        if (url.includes('RestorePartial')) return 'restoreStudentForm';
        return null;
    }

    async function loadPartial(url) {
        const expectedFormId = expectedFormIdForUrl(url);
        try {
            const res = await fetch(url, { credentials: 'same-origin' });

            if (res.status === 401 || res.status === 403) {
                showNotify('برای انجام این عملیات لازم است وارد شوید (احتمالاً صفحهٔ ورود بازگشت داده شده).', 'warning', 5000);
                console.warn('Unauthorized (401/403) when loading partial:', url, 'status:', res.status);
                return;
            }

            if (res.status === 404) {
                showNotify('فرم مورد نظر پیدا نشد (404). لطفاً بررسی کنید اکشن مورد نظر در کنترلر وجود داشته باشد.', 'error', 6000);
                console.error('Partial not found (404):', url);
                return;
            }

            if (!res.ok) {
                showNotify('خطا در بارگذاری فرم. لطفاً دوباره تلاش کنید. (کد: ' + res.status + ')', 'error', 6000);
                const txt = await res.text();
                console.error('Partial load failed:', url, 'status:', res.status, 'response:', txt);
                return;
            }

            const html = await res.text();

            if (expectedFormId) {
                if (!html.includes(`id="${expectedFormId}"`) && !html.includes(`id='${expectedFormId}'`)) {
                    showNotify('فرم مورد انتظار در پاسخ سرور پیدا نشد. احتمال بازگشت صفحهٔ ورود یا خطای سرور. برای جزئیات کنسول را بررسی کنید.', 'error', 7000);
                    console.error('Expected form id not found in partial HTML. URL:', url, 'ExpectedId:', expectedFormId, 'HTML snippet:', html.substring(0, 1000));
                    return;
                }
            }

            if (modalContentAjax) {
                modalContentAjax.innerHTML = html;
                bindAjaxForm();
                showAjasmodal();
            } else if (ajasmodal) {
                // fallback: put html into ajasmodal container
                ajasmodal.innerHTML = html;
                bindAjaxForm();
                showAjasmodal();
            } else {
                showNotify('خطا داخلی: modal container پیدا نشد.', 'error', 5000);
                console.error('modalContentAjax not found while loading partial:', url);
            }
        } catch (err) {
            console.error('Network or fetch error loading partial:', url, err);
            showNotify('خطای شبکه هنگام بارگذاری فرم. لطفاً اتصال خود را بررسی کنید.', 'error', 6000);
        }
    }

    /* =========================
       Delegated click handling for Edit/Delete/Restore (uses loadPartial)
    ========================= */
    // This delegation is kept for safety if tbody not present; the table-body delegation below is primary.
    document.addEventListener('click', function (e) {
        const editBtn = e.target.closest('.open-edit-modal');
        if (editBtn) {
            const id = editBtn.dataset.id;
            if (id) loadPartial(`/Students/EditPartial?id=${id}`);
            return;
        }

        const deleteBtn = e.target.closest('.open-delete-modal');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (id) loadPartial(`/Students/DeletePartial?id=${id}`);
            return;
        }

        const restoreBtn = e.target.closest('.open-restore-modal');
        if (restoreBtn) {
            const id = restoreBtn.dataset.id;
            if (!id) {
                console.warn('Restore button clicked but no data-id found.', restoreBtn);
                showNotify('شناسه دانش‌آموز معتبر نیست و عملیات فعال‌سازی انجام نشد.', 'error', 5000);
                return;
            }
            loadPartial(`${restorePartialUrl}?id=${encodeURIComponent(id)}`);
            return;
        }
    });

    function bindAjaxForm() {
        const editCancel = document.getElementById('editCancelBtn');
        if (editCancel) editCancel.addEventListener('click', closeAjasmodal);

        const deleteCancel = document.getElementById('deleteCancelBtn');
        if (deleteCancel) deleteCancel.addEventListener('click', closeAjasmodal);

        const restoreCancel = document.querySelector('#restoreStudentForm #deleteCancelBtn') || document.getElementById('deleteCancelBtn');
        if (restoreCancel) restoreCancel.addEventListener('click', closeAjasmodal);

        // Edit form
        const editForm = document.getElementById('editStudentForm');
        if (editForm) {
            editForm.addEventListener('submit', async function (ev) {
                ev.preventDefault();
                try {
                    const formData = new FormData(editForm);
                    const action = editForm.getAttribute('action') || '/Students/EditPartial';
                    const res = await fetch(action, { method: 'POST', body: formData, credentials: 'same-origin' });
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success) {
                            showNotify(json.message || 'اطلاعات با موفقیت ویرایش شد.', 'success', 3500);
                            if (json.student) updateRowWithStudent(json.student, json.student.isActive);
                            await refreshInactiveCountOnPage(pageShowInactive === true);
                            closeAjasmodal();
                            return;
                        } else {
                            showNotify(json.message || 'خطا در ذخیره‌سازی.', 'error', 5000);
                        }
                    } else {
                        if (res.status === 400) {
                            const html = await res.text();
                            modalContentAjax.innerHTML = html;
                            bindAjaxForm();
                            return;
                        }
                        const txt = await res.text();
                        console.error('Edit form error:', res.status, txt);
                        showNotify('خطا در ویرایش (کد: ' + res.status + ')', 'error', 5000);
                    }
                } catch (err) {
                    console.error('Edit submit exception:', err);
                    showNotify('خطای شبکه در ارسال فرم ویرایش.', 'error', 5000);
                }
            });
        }

        // Delete form
        const deleteForm = document.getElementById('deleteStudentForm');
        if (deleteForm) {
            deleteForm.addEventListener('submit', async function (ev) {
                ev.preventDefault();
                try {
                    const formData = new FormData(deleteForm);
                    const action = deleteForm.getAttribute('action') || '/Students/DeletePartialConfirmed';
                    const res = await fetch(action, { method: 'POST', body: formData, credentials: 'same-origin' });
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success) {
                            showNotify(json.message || 'اطلاعات با موفقیت غیرفعال شد.', 'success', 3500);
                            const row = findRowById(json.id);
                            if (row) row.remove();
                            await rebuildTableBodyFromServerPaged(currentPage, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || ''));
                            await refreshInactiveCountOnPage(pageShowInactive === true);
                            closeAjasmodal();
                            return;
                        } else {
                            showNotify(json.message || 'خطا در حذف.', 'error', 5000);
                        }
                    } else {
                        const txt = await res.text();
                        console.error('Delete error:', res.status, txt);
                        showNotify('خطا در حذف (کد: ' + res.status + ')', 'error', 5000);
                    }
                } catch (err) {
                    console.error('Delete submit exception:', err);
                    showNotify('خطای شبکه در حذف.', 'error', 5000);
                }
            });
        }

        // Restore form
        const restoreForm = document.getElementById('restoreStudentForm');
        if (restoreForm) {
            restoreForm.addEventListener('submit', async function (ev) {
                ev.preventDefault();
                const formData = new FormData(restoreForm);
                const actionUrl = restoreForm.getAttribute('action') || restorePartialConfirmedUrl;

                try {
                    const res = await fetch(actionUrl, { method: 'POST', body: formData, credentials: 'same-origin' });
                    if (!res.ok) {
                        showNotify('خطا در فعال‌سازی (کد: ' + res.status + ')', 'error', 5000);
                        return;
                    }

                    const json = await res.json();
                    if (!json.success) {
                        showNotify(json.message || 'خطا در فعال‌سازی.', 'error', 5000);
                        return;
                    }

                    showNotify(json.message || 'دانش‌آموز با موفقیت فعال شد.', 'success', 3000);

                    const wasShowingInactive = (pageShowInactive === true || pageShowInactive === 'true');

                    if (wasShowingInactive) {
                        const existingRow = document.getElementById('row-' + json.id);
                        if (existingRow) {
                            existingRow.remove();
                        } else {
                            await rebuildTableBodyFromServerPaged(currentPage, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || ''));
                        }
                    } else {
                        const existingRow = document.getElementById('row-' + json.id);
                        if (existingRow) {
                            updateRowWithStudent(json.student, !!json.student.isActive);
                        } else {
                            await rebuildTableBodyFromServerPaged(currentPage, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || ''));
                        }
                    }

                    await refreshInactiveCountOnPage(pageShowInactive === true);
                    closeAjasmodal();
                } catch (err) {
                    console.error('Restore submit exception:', err);
                    showNotify('خطای شبکه در فعال‌سازی.', 'error', 5000);
                }
            });
        }
    }

    try { bindAjaxForm(); } catch (e) { /* ignore */ }

    // =========================
    // Server-side paging (ListPaged)
    // =========================
    async function rebuildTableBodyFromServerPaged(page = 1, pageSize = defaultPageSize, search = '', showInactive = (pageShowInactive === true || pageShowInactive === 'true')) {
        try {
            page = parseInt(page, 10) || 1;
            pageSize = parseInt(pageSize, 10) || defaultPageSize;

            const url = `${listPagedUrl}?page=${page}&pageSize=${pageSize}&showInactive=${showInactive}&search=${encodeURIComponent(search)}`;
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) {
                console.error('Failed to fetch paged students list:', res.status);
                if (res.status >= 400 && res.status < 500) showNotify('درخواست با خطا مواجه شد. لطفاً دوباره تلاش کنید.', 'error', 4000);
                return;
            }
            const json = await res.json();
            const students = json.students || [];
            // Target tbody by id #students-table-body (safe), fallback to first table tbody
            const tbody = document.querySelector('#students-table-body') || document.querySelector('#studentsTable tbody') || document.querySelector('table tbody');
            if (!tbody) return;

            tbody.innerHTML = students.map(s => buildRowHtmlFromData(s)).join('');

            currentPage = json.currentPage || page;
            const totalPages = json.totalPages || 1;
            const totalCount = json.totalCount || 0;
            const inactiveCount = json.inactiveCount || 0;

            const totalCountEl = document.getElementById('studentsTotalCount');
            if (totalCountEl) totalCountEl.textContent = totalCount;
            const inactiveCountEl = document.getElementById('studentsInactiveCount');
            if (inactiveCountEl) inactiveCountEl.textContent = inactiveCount;
            const currentPageEl = document.getElementById('studentsCurrentPage');
            if (currentPageEl) currentPageEl.textContent = currentPage;
            const totalPagesEl = document.getElementById('studentsTotalPages');
            if (totalPagesEl) totalPagesEl.textContent = totalPages;

            bindAjaxForm();
            await refreshInactiveCountOnPage(showInactive);
            updatePaginationControls(totalPages, currentPage);
        } catch (err) {
            console.error('Error rebuilding paged table body:', err);
            showNotify('خطای شبکه هنگام دریافت فهرست. لطفاً اتصال را بررسی کنید.', 'error', 5000);
        }
    }

    function updatePaginationControls(totalPages, currentPageLocal) {
        const container = document.getElementById('paginationContainer');
        if (!container) return;
        container.innerHTML = '';

        const prev = document.createElement('button');
        prev.className = 'bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 transition';
        prev.textContent = 'قبلی';
        prev.disabled = currentPageLocal <= 1;
        prev.addEventListener('click', () => {
            if (currentPageLocal > 1) rebuildTableBodyFromServerPaged(currentPageLocal - 1, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || ''));
        });
        container.appendChild(prev);

        const maxButtons = 7;
        const half = Math.floor(maxButtons / 2);
        let start = Math.max(1, currentPageLocal - half);
        let end = Math.min(totalPages, start + maxButtons - 1);
        if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

        if (start > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'px-2 py-1 rounded border mx-0.5';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => rebuildTableBodyFromServerPaged(1, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || '')));
            container.appendChild(firstBtn);
            if (start > 2) {
                const dots = document.createElement('span');
                dots.className = 'px-2 py-1 text-sm text-slate-800';
                dots.textContent = '...';
                container.appendChild(dots);
            }
        }

        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = `px-2 py-1 rounded ${i === currentPageLocal ? 'bg-slate-100 text-blue-800' : 'bg-white text-blue-800'}`;
            btn.textContent = i;
            btn.addEventListener('click', () => rebuildTableBodyFromServerPaged(i, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || '')));
            container.appendChild(btn);
        }

        if (end < totalPages) {
            if (end < totalPages - 1) {
                const dots2 = document.createElement('span');
                dots2.className = 'px-2 text-sm text-slate-800';
                dots2.textContent = '...';
                container.appendChild(dots2);
            }
            const lastBtn = document.createElement('button');
            lastBtn.className = 'px-2 py-2 rounded mx-0.5';
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => rebuildTableBodyFromServerPaged(totalPages, (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize), (document.getElementById('studentSearchInput')?.value || '')));
            container.appendChild(lastBtn);
        }

        const next = document.createElement('button');
        next.className = 'bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 transition';
        next.textContent = 'بعدی';
        next.disabled = currentPageLocal >= totalPages;
        next.addEventListener('click', () => {
            const targetPage = Math.min(totalPages, (typeof currentPageLocal === 'number' ? currentPageLocal + 1 : 1));
            if (targetPage <= totalPages) {
                const ps = (document.getElementById('studentsPageSize')?.value ? parseInt(document.getElementById('studentsPageSize').value, 10) : defaultPageSize);
                const q = (document.getElementById('studentSearchInput')?.value || '').trim();
                rebuildTableBodyFromServerPaged(targetPage, ps, q);
            }
        });
        container.appendChild(next);
    }

    // =========================
    // Search integration (debounced) and pageSize select
    // =========================
    function debounce(fn, delay = 350) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    const searchInput = document.getElementById('studentSearchInput');
    const pageSizeSelect = document.getElementById('studentsPageSize');

    function currentPageSize() {
        if (pageSizeSelect) {
            const v = parseInt(pageSizeSelect.value, 10);
            if (!isNaN(v) && v > 0) return v;
        }
        return defaultPageSize;
    }

    const debouncedSearch = debounce(function () {
        const q = searchInput ? (searchInput.value || '').trim() : '';
        const ps = currentPageSize();
        rebuildTableBodyFromServerPaged(1, ps, q);
    }, 400);

    if (searchInput) searchInput.addEventListener('input', debouncedSearch);
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function () {
            const ps = currentPageSize();
            rebuildTableBodyFromServerPaged(1, ps, (searchInput ? searchInput.value.trim() : ''));
        });
    }

    // =========================
    // Toggle inactive button management (AJAX refresh)
    // =========================
    function setToggleInactiveButton(count, currentShowInactive) {
        const btn = document.getElementById('toggleInactiveBtn');
        if (!btn) return;

        if (count > 0) {
            if (btn.tagName.toLowerCase() === 'button') {
                const a = document.createElement('a');
                a.id = btn.id;
                a.className = 'inline-block bg-slate-200 font-bold text-slate-800 px-3 py-2 rounded hover:bg-emerald-300 transition';
                a.href = currentShowInactive ? showInactiveFalseUrl : showInactiveTrueUrl;
                a.title = 'نمایش دانش‌آموزان غیرفعال/فعال';
                a.textContent = currentShowInactive ? 'نمایش رکوردهای فعال' : 'نمایش رکوردهای غیرفعال';
                btn.replaceWith(a);
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
                btn.href = currentShowInactive ? showInactiveFalseUrl : showInactiveTrueUrl;
                btn.textContent = currentShowInactive ? 'نمایش رکوردهای فعال' : 'نمایش رکوردهای غیرفعال';
                btn.removeAttribute('aria-disabled');
            }
        } else {
            if (btn.tagName.toLowerCase() === 'a') {
                const b = document.createElement('button');
                b.id = btn.id;
                b.className = 'px-2 py-1 rounded border text-sm opacity-50 cursor-not-allowed pointer-events-none';
                b.disabled = true;
                b.setAttribute('aria-disabled', 'true');
                b.title = 'فعلاً هیچ دانش‌آموز غیرفعالی ثبت نشده است';
                b.textContent = 'نمایش رکوردهای غیرفعال';
                btn.replaceWith(b);
            } else {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
                btn.setAttribute('aria-disabled', 'true');
                btn.title = 'فعلاً هیچ دانش‌آموز غیرفعالی ثبت نشده است';
            }
        }
    }

    async function refreshInactiveCountOnPage(currentShowInactive = false) {
        try {
            const res = await fetch(inactiveCountUrl, { credentials: 'same-origin' });
            if (!res.ok) return;
            const json = await res.json();
            const count = parseInt(json.count || 0, 10);
            setToggleInactiveButton(count, currentShowInactive);
            const inactiveCountEl = document.getElementById('studentsInactiveCount');
            if (inactiveCountEl) inactiveCountEl.textContent = count;
        } catch (err) {
            console.error('Error fetching inactive count:', err);
        }
    }

    try { refreshInactiveCountOnPage(pageShowInactive === true || pageShowInactive === 'true'); } catch (e) { }

    // =========================
    // Initial load
    // =========================
    rebuildTableBodyFromServerPaged(currentPage, defaultPageSize, (searchInput ? (searchInput.value || '') : ''));

})();