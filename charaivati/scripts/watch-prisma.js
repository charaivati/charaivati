// node scripts/watch-prisma.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: [{ level: 'query', emit: 'event' }, { level: 'error', emit: 'event' }]
});
prisma.$on('query', (e) => {
  const q = e.query || '';
  if (/\\b(DROP|TRUNCATE|DELETE|ALTER)\\b/i.test(q)) {
    console.log('DESTRUCTIVE QUERY:', q);
  }
});
console.log('Watching for destructive queries...');
setInterval(()=>{}, 1000);
