(function () {

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function parseShamsiString(sh) {
        if (!sh) return null;
        sh = sh.replace(/[\uFF0F\u2215]/g, '/').trim();
        const m = sh.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (!m) return null;
        return {
            year: parseInt(m[1], 10),
            month: parseInt(m[2], 10),
            day: parseInt(m[3], 10)
        };
    }

    function createPickerForInput(input, hiddenYear, hiddenMonth, hiddenDay) {
        if (!input) return;

        let picker = null;

        function build() {
            if (picker) picker.remove();

            picker = document.createElement('div');
            picker.className = 'sh-datepicker';

            const years = document.createElement('select');
            for (let y = 1460; y >= 1360; y--) {
                years.innerHTML += `<option value="${y}">${y}</option>`;
            }

            const months = document.createElement('select');
            for (let m = 1; m <= 12; m++) {
                months.innerHTML += `<option value="${m}">${pad(m)}</option>`;
            }

            const days = document.createElement('select');
            for (let d = 1; d <= 31; d++) {
                days.innerHTML += `<option value="${d}">${pad(d)}</option>`;
            }

            const row = document.createElement('div');
            row.className = 'row';
            row.append(years, months, days);

            const actions = document.createElement('div');
            actions.className = 'actions';

            const ok = document.createElement('button');
            ok.className = 'btn-ok';
            ok.textContent = 'انتخاب';

            const cancel = document.createElement('button');
            cancel.className = 'btn-cancel';
            cancel.textContent = 'انصراف';

            ok.onclick = () => {
                input.value = `${years.value}/${pad(months.value)}/${pad(days.value)}`;
                if (hiddenYear) hiddenYear.value = years.value;
                if (hiddenMonth) hiddenMonth.value = months.value;
                if (hiddenDay) hiddenDay.value = days.value;
                picker.remove();
            };

            cancel.onclick = () => picker.remove();

            actions.append(cancel, ok);
            picker.append(row, actions);
            document.body.appendChild(picker);

            const r = input.getBoundingClientRect();
            picker.style.top = (r.bottom + window.scrollY + 5) + 'px';
            picker.style.left = r.left + 'px';
        }

        input.addEventListener('focus', build);
        input.addEventListener('click', build);
    }

    // 👇 در دسترس کل پروژه
    window.attachShamsiDatePicker = createPickerForInput;

})();
