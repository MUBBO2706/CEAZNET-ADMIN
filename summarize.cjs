const fs = require('fs');

function extractInfo(queries) {
  const tables = new Set();
  const functions = new Set();
  const triggers = new Set();
  const policies = new Set();
  const views = new Set();
  const extensions = new Set();
  const publications = new Set();
  
  queries.forEach(q => {
    const sql = q.sql.toLowerCase();
    
    // Extract tables
    const tableMatches = sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_.\"']+)/g);
    for (const match of tableMatches) {
      tables.add(match[1].replace(/\"/g, '').replace('public.', ''));
    }
    
    // Extract functions
    const funcMatches = sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_.\"']+)/g);
    for (const match of funcMatches) {
      functions.add(match[1].replace(/\"/g, '').replace('public.', ''));
    }
    
    // Extract triggers
    const trigMatches = sql.matchAll(/create\s+trigger\s+([a-z0-9_.\"']+)/g);
    for (const match of trigMatches) {
      triggers.add(match[1].replace(/\"/g, ''));
    }
    
    // Extract policies
    const polMatches = sql.matchAll(/create\s+policy\s+([a-z0-9_.\"']+)\s+on\s+([a-z0-9_.\"']+)/g);
    for (const match of polMatches) {
      policies.add(match[1].replace(/\"/g, '') + ' on ' + match[2].replace(/\"/g, '').replace('public.', ''));
    }
    
    const viewMatches = sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+([a-z0-9_.\"']+)/g);
    for (const match of viewMatches) {
      views.add(match[1].replace(/\"/g, '').replace('public.', ''));
    }

    const extMatches = sql.matchAll(/create\s+extension\s+(?:if\s+not\s+exists\s+)?([a-z0-9_.\"']+)/g);
    for (const match of extMatches) {
      extensions.add(match[1].replace(/\"/g, ''));
    }

    const pubMatches = sql.matchAll(/alter\s+publication\s+([a-z0-9_.\"']+)/g);
    for (const match of pubMatches) {
      publications.add(match[1].replace(/\"/g, ''));
    }
  });
  
  return {
    tables: Array.from(tables).sort(),
    functions: Array.from(functions).sort(),
    triggers: Array.from(triggers).sort(),
    policies: Array.from(policies).sort(),
    views: Array.from(views).sort(),
    extensions: Array.from(extensions).sort(),
    publications: Array.from(publications).sort(),
  };
}

const oldQ = JSON.parse(fs.readFileSync('old_queries_new.json', 'utf8'));
const newQ = JSON.parse(fs.readFileSync('new_queries_new.json', 'utf8'));

const oldInfo = extractInfo(oldQ);
const newInfo = extractInfo(newQ);

// Diff
const missingTables = oldInfo.tables.filter(t => !newInfo.tables.includes(t));
const extraTables = newInfo.tables.filter(t => !oldInfo.tables.includes(t));

const missingFunctions = oldInfo.functions.filter(t => !newInfo.functions.includes(t));
const extraFunctions = newInfo.functions.filter(t => !oldInfo.functions.includes(t));

const missingTriggers = oldInfo.triggers.filter(t => !newInfo.triggers.includes(t));
const missingPolicies = oldInfo.policies.filter(t => !newInfo.policies.includes(t));
const missingViews = oldInfo.views.filter(t => !newInfo.views.includes(t));
const missingExtensions = oldInfo.extensions.filter(t => !newInfo.extensions.includes(t));
const missingPublications = oldInfo.publications.filter(t => !newInfo.publications.includes(t));

console.log('\n--- DIFF REPORT ---');
console.log('Missing Tables in New:', missingTables);
console.log('Extra Tables in New:', extraTables);
console.log('Missing Functions in New:', missingFunctions);
console.log('Extra Functions in New:', extraFunctions);
console.log('Missing Triggers in New:', missingTriggers);
console.log('Missing Policies in New:', missingPolicies);
console.log('Missing Views in New:', missingViews);
console.log('Missing Extensions in New:', missingExtensions);
console.log('Missing Publications in New:', missingPublications);
