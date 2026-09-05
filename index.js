const express = require('express');
const app = express();
app.use(express.json({ type: ['application/json', 'application/scim+json'] }));

// Ensure all responses use the correct SCIM content type
app.use((req, res, next) => {
  res.type('application/scim+json');
  next();
});

// Log every incoming request and outgoing response
app.use((req, res, next) => {
  console.log('--- Incoming Request ---');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body:', req.body);

  const originalJson = res.json;
  res.json = function (data) {
  console.log('--- Outgoing Response ---');
  console.log('Status:', res.statusCode);
  console.log('Content-Type Header:', res.getHeader('content-type'));
  console.log('Body:', JSON.stringify(data));
  console.log('-------------------------');
  return originalJson.call(this, data);
};

  next();
});

const PORT = 3000;

// Temporary in-memory storage for users
let users = [];
let nextId = 1;

// SCIM requires this endpoint to describe what the server supports
app.get('/scim/v2/ServiceProviderConfig', (req, res) => {
  res.json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    patch: { supported: true },
    bulk: { supported: false },
    filter: { supported: true },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false }
  });
});

// POST - Create a new user (this runs when Okta provisions someone)
app.post('/scim/v2/Users', (req, res) => {
  const newUser = {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: String(nextId++),
    userName: req.body.userName,
    name: req.body.name,
    active: true
  };
  users.push(newUser);
  console.log('User created:', newUser.userName);
  res.status(201).json(newUser);
});

// GET a specific user by ID (Okta uses this to check user status)
app.get('/scim/v2/Users', (req, res) => {
  let results = users;

  if (req.query.filter) {
    const match = req.query.filter.match(/userName eq "(.+)"/);
    if (match) {
      const usernameToFind = match[1];
      results = users.filter(u => u.userName === usernameToFind);
    }
  }

  res.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: results.length,
    startIndex: 1,
    itemsPerPage: results.length,
    Resources: results
  });
});

// GET Groups (Okta checks this during sync even if we don't use groups yet)
app.get('/scim/v2/Groups', (req, res) => {
  res.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 0,
    startIndex: 1,
    itemsPerPage: 0,
    Resources: []
  });
});

// PATCH - Update or deactivate a user (this runs when Okta updates/deprovisions someone)
app.patch('/scim/v2/Users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "User not found",
      status: "404"
    });
  }

  const operations = req.body.Operations || [];
operations.forEach(op => {
  if (op.path === 'active') {
    user.active = op.value;
    console.log(`User ${user.userName} active status changed to:`, op.value);
  } else if (op.op === 'replace' && typeof op.value === 'object' && op.value !== null && 'active' in op.value) {
    user.active = op.value.active;
    console.log(`User ${user.userName} active status changed to:`, op.value.active);
  }
});

  res.json(user);
});

app.listen(PORT, () => {
  console.log(`SCIM server running on http://localhost:${PORT}`);
});