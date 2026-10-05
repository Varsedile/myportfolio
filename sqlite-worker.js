// Run SQLite away from the UI, with a row cap for custom queries.
let database;
self.onmessage = async ({ data }) => {
    if (data.type === 'init') {
        try {
            const cdn = 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/';
            importScripts(cdn + 'sql-wasm.js');
            const SQL = await initSqlJs({ locateFile: file => cdn + file });
            database = new SQL.Database();
            database.run(data.seed);
            database.run('PRAGMA query_only = ON;');
            self.postMessage({ type: 'ready' });
        } catch (error) { self.postMessage({ type: 'failure', message: error.message }); }
        return;
    }
    const start = performance.now();
    try {
        const code = data.sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]/g, ' ');
        if (!/^\s*(SELECT|WITH)\b/i.test(code) || /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX|ANALYZE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(code)) {
            throw Error('Permission denied: this database is read-only.');
        }
        const results = [];
        for (const statement of database.iterateStatements(data.sql)) {
            const rows = [], columns = statement.getColumnNames();
            while (rows.length < 50 && statement.step()) rows.push(statement.getAsObject());
            const limited = rows.length === 50 && statement.step();
            results.push({ columns, rows, limited });
        }
        self.postMessage({ type: 'result', id: data.id, results, time: performance.now() - start });
    } catch (error) { self.postMessage({ type: 'result', id: data.id, error: error.message, time: performance.now() - start }); }
};
