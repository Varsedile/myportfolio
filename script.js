// Hidden portfolio content is the source of truth for terminal queries.
(() => {
    const terminal = document.querySelector('.portfolio-terminal');
    const form = document.getElementById('terminal-form');
    const input = document.getElementById('terminal-input');
    const results = document.getElementById('terminal-results');
    const status = document.getElementById('terminal-status');
    const projectNodes = [...document.querySelectorAll('#projects-area .project')];
    const skillNodes = [...document.querySelectorAll('.skills-area .skill')];
    const experienceNodes = [...document.querySelectorAll('#experience-area .experience')];
    const educationNodes = [...document.querySelectorAll('.education-area .education')];
    const courseNodes = [...document.querySelectorAll('.courses-area .course')];
    // Contact destinations come from the HTML, so editing your email there updates SQLite too.
    const contactNodes = [...document.querySelectorAll('[data-contact-label]')];
    const history = [];
    let position = 0, draft = '', worker, ready = false, queued = 'SELECT * FROM projects;', sequence = 0, active, timeout, bootTimeout;
    const text = node => node?.textContent.trim() || '';
    const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
    const add = (table, rows) => rows.map(row => `INSERT INTO ${table} VALUES (${row.map(literal).join(',')});`).join('\n');
    const seed = `
        CREATE TABLE projects(id INTEGER PRIMARY KEY, name TEXT, description TEXT, tools TEXT, github_url TEXT);
        CREATE TABLE skills(id INTEGER PRIMARY KEY, category TEXT, name TEXT);
        CREATE TABLE experience(id INTEGER PRIMARY KEY, role TEXT, dates TEXT, highlights TEXT);
        CREATE TABLE education(id INTEGER PRIMARY KEY, qualification TEXT, institution TEXT);
        CREATE TABLE courses(id INTEGER PRIMARY KEY, name TEXT, issuer TEXT, date TEXT);
        CREATE TABLE links(id INTEGER PRIMARY KEY, label TEXT, url TEXT);
        ${add('projects', projectNodes.map((node, index) => [index + 1, text(node.querySelector('h4')), text(node.querySelector('p')), text(node.querySelector('.project-tools')), node.querySelector('a').href]))}
        ${add('skills', skillNodes.flatMap(node => [...node.querySelectorAll('li')].map(li => [text(node.querySelector('strong')), text(li)])).map((row, index) => [index + 1, ...row]))}
        ${add('experience', experienceNodes.map((node, index) => [index + 1, text(node.querySelector('h4')), text(node.querySelector('.date-experience')), [...node.querySelectorAll('li')].map(text).join('\n')]))}
        ${add('education', educationNodes.map((node, index) => [index + 1, text(node.querySelector('h4')), text(node.querySelector('p'))]))}
        ${add('courses', courseNodes.map((node, index) => [index + 1, text(node.querySelector('h4')), text(node.querySelector('p')), node.querySelector('time')?.getAttribute('datetime') || '']))}
        ${add('links', contactNodes.map((link, index) => [index + 1, link.dataset.contactLabel, link.getAttribute('href')]))}
    `;
    function node(tag, content, className) {
        const element = document.createElement(tag);
        if (content != null) element.textContent = content;
        if (className) element.className = className;
        return element;
    }
    function message(content) { results.hidden = false; results.replaceChildren(node('p', content)); }
    // Each rendered project owns its gallery. Dots are generated from its image count.
    function setupGalleries(project) {
        project.querySelectorAll('.slider').forEach(slider => {
            const track = slider.querySelector('.track');
            const slides = [...slider.querySelectorAll('.project-img')];
            if (!track || !slides.length) return;
            let selected = 0;
            const title = text(project.querySelector('h4'));
            const pagination = node('div', null, 'gallery-pagination');
            pagination.setAttribute('role', 'group');
            pagination.setAttribute('aria-label', title + ' screenshot navigation');
            const announcement = node('span', null, 'visually-hidden');
            announcement.setAttribute('aria-live', 'polite');
            const dots = slides.map((slide, index) => {
                const dot = node('button', null, 'gallery-dot');
                dot.type = 'button';
                dot.setAttribute('aria-label', `Show screenshot ${index + 1} of ${slides.length}`);
                dot.addEventListener('click', () => show(index));
                pagination.append(dot);
                return dot;
            });
            function show(index) {
                selected = index;
                track.style.transform = `translateX(-${selected * 100}%)`;
                slides.forEach((slide, position) => slide.setAttribute('aria-hidden', String(position !== selected)));
                dots.forEach((dot, position) => dot.setAttribute('aria-pressed', String(position === selected)));
                announcement.textContent = `Screenshot ${selected + 1} of ${slides.length}`;
            }
            function keyboard(event) {
                if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                event.stopPropagation();
                show((selected + (event.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length);
                if (pagination.contains(event.target)) dots[selected].focus();
            }
            if (slides.length > 1) {
                slider.tabIndex = 0;
                slider.setAttribute('aria-label', title + ' screenshots');
                slider.addEventListener('keydown', keyboard);
                pagination.addEventListener('keydown', keyboard);
                pagination.append(announcement);
                slider.append(pagination);
            } else slider.removeAttribute('tabindex');
            show(0);
        });
    }
    function clone(source) {
        const copy = source.cloneNode(true);
        [copy, ...copy.querySelectorAll('[id]')].forEach(element => element.removeAttribute('id'));
        copy.querySelectorAll('button').forEach(button => button.remove());
        copy.querySelectorAll('[aria-hidden]').forEach(element => element.removeAttribute('aria-hidden'));
        const track = copy.querySelector('.track');
        if (track) track.style.transform = 'none';
        setupGalleries(copy);
        const tools = copy.querySelector('.project-tools');
        if (tools) {
            const names = tools.textContent.split('·').map(name => name.trim());
            tools.replaceChildren(...names.map(name => node('span', name)));
        }
        return copy;
    }
    function render(result) {
        const grid = node('div', null, 'terminal-result-grid');
        if (result.columns.includes('category') && result.columns.includes('name')) {
            for (const category of [...new Set(result.rows.map(row => row.category))]) {
                const card = node('article', null, 'terminal-result-card result-skill');
                card.append(node('h4', category));
                const list = node('div', null, 'skill-tags');
                result.rows.filter(row => row.category === category).forEach(row => list.append(node('span', row.name)));
                card.append(list); grid.append(card);
            }
            if (!result.rows.length) grid.append(node('p', 'No rows found. Try a different query.'));
            return grid;
        }
        for (const row of result.rows) {
            const card = node('article', null, 'terminal-result-card');
            // Full rows use existing portfolio components. Custom projections use clean cards.
            if (['name','description','tools','github_url'].every(key => result.columns.includes(key)) && projectNodes[row.id - 1]) { card.classList.add('result-project'); card.append(clone(projectNodes[row.id - 1])); }
            else if (['role','dates','highlights'].every(key => result.columns.includes(key)) && experienceNodes[row.id - 1]) { card.classList.add('result-experience'); card.append(clone(experienceNodes[row.id - 1])); }
            else if (['qualification','institution'].every(key => result.columns.includes(key)) && educationNodes[row.id - 1]) { card.classList.add('result-education'); card.append(clone(educationNodes[row.id - 1])); }
            else if (['name','issuer'].every(key => result.columns.includes(key)) && courseNodes[row.id - 1]) { card.classList.add('result-course'); card.append(clone(courseNodes[row.id - 1])); }
            else if (['label','url'].every(key => result.columns.includes(key))) {
                card.classList.add('result-contact');
                card.append(node('h4', row.label));
                const url = String(row.url || '');
                const display = url.replace(/^https?:\/\/|^mailto:/i, '');
                if (/^(https?:\/\/|mailto:)/i.test(url)) {
                    const link = node('a', display);
                    link.href = url;
                    if (/^https?:/i.test(url)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
                    card.append(link);
                } else card.append(node('p', display));
            }
            else {
                const details = node('dl');
                for (const key of result.columns) {
                    details.append(node('dt', key));
                    const value = row[key], entry = node('dd');
                    if (typeof value === 'string' && /^(https:\/\/|mailto:)/.test(value)) {
                        const link = node('a', row.label || value);
                        link.href = value;
                        if (value.startsWith('https:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
                        entry.append(link);
                    } else entry.textContent = value == null ? 'NULL' : String(value);
                    details.append(entry);
                }
                card.append(details);
            }
            grid.append(card);
        }
        if (!result.rows.length) grid.append(node('p', 'No rows found. Try a different query.'));
        return grid;
    }
    function execute(command) {
        command = command.trim();
        if (!command) return;
        terminal.querySelectorAll('[data-sql]').forEach(button => {
            const selected = button.dataset.sql === command;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        history.push(command); position = history.length; draft = ''; input.value = command;
        if (command === '.clear') { queued = ''; if (active) active.silent = true; results.replaceChildren(); results.hidden = true; return; }
        if (command === '.help') { queued = ''; if (active) active.silent = true; message('SELECT queries run in SQLite. Try SELECT name FROM projects; or SELECT * FROM skills WHERE category = \'Data Engineering\';. Use .tables, .schema and .clear. Up and Down browse history. Results show up to 50 rows.'); return; }
        if (command.startsWith('.') && !['.tables','.schema'].includes(command)) { message('Unknown command. Try .help.'); return; }
        if (!ready) { queued = command; message('SQLite is loading. Your query will run when it is ready.'); return; }
        const sql = command === '.tables' ? "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY CASE name WHEN 'projects' THEN 0 WHEN 'experience' THEN 1 WHEN 'education' THEN 2 WHEN 'courses' THEN 3 WHEN 'skills' THEN 4 WHEN 'links' THEN 5 ELSE 6 END, name;" : command === '.schema' ? "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY CASE name WHEN 'projects' THEN 0 WHEN 'experience' THEN 1 WHEN 'education' THEN 2 WHEN 'courses' THEN 3 WHEN 'skills' THEN 4 WHEN 'links' THEN 5 ELSE 6 END, name;" : command;
        const id = ++sequence; active = { id, sql }; status.textContent = 'Running query…';
        clearTimeout(timeout); worker.postMessage({ type: 'query', id, sql });
        timeout = setTimeout(() => { worker.terminate(); active = null; queued = ''; ready = false; message('Query stopped after 4 seconds. Reconnecting to SQLite.'); start(); }, 4000);
    }
    function fail() { clearTimeout(bootTimeout); ready = false; worker.terminate(); status.textContent = 'SQLite unavailable'; message('SQLite could not load. Check your connection and reload to retry.'); }
    function start() {
        status.textContent = 'Loading SQLite…';
        try { worker = new Worker('sqlite-worker.js'); } catch { status.textContent = 'SQLite unavailable'; message('Open the portfolio through a local server or hosted website to use SQLite.'); return; }
        bootTimeout = setTimeout(fail, 15000);
        worker.onerror = fail;
        worker.onmessage = ({ data }) => {
            if (data.type === 'failure') { fail(); return; }
            if (data.type === 'ready') { clearTimeout(bootTimeout); ready = true; status.textContent = 'SQLite / read-only'; if (queued) { const command = queued; queued = ''; execute(command); } return; }
            if (data.id !== active?.id) return;
            clearTimeout(timeout); status.textContent = 'SQLite / read-only';
            const sql = active.sql; const silent = active.silent; active = null; if (silent) return; results.hidden = false; results.replaceChildren();
            const count = data.results?.reduce((sum, set) => sum + set.rows.length, 0) || 0;
            const meta = node('div', null, 'query-meta');
            meta.append(node('code', sql), node('span', `${count} ${count === 1 ? 'row' : 'rows'}${data.results?.some(set => set.limited) ? ' shown (50 row limit)' : ''} · ${data.time.toFixed(2)} ms`));
            results.append(meta);
            if (data.error) results.append(node('p', data.error));
            else data.results.forEach(set => results.append(render(set)));
        };
        worker.postMessage({ type: 'init', seed });
    }
    terminal.hidden = false;
    form.addEventListener('submit', event => { event.preventDefault(); execute(input.value); });
    document.querySelectorAll('[data-sql]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        execute(button.dataset.sql);
        if (!terminal.contains(button)) terminal.scrollIntoView({ block: 'start' });
    }));
    input.addEventListener('keydown', event => {
        if (!['ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        if (position === history.length) draft = input.value;
        position = Math.max(0, Math.min(history.length, position + (event.key === 'ArrowUp' ? -1 : 1)));
        input.value = position === history.length ? draft : history[position];
    });
    start();
})();
