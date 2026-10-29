import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportingStructure } from '../src/lib/reporting-structure.ts';

const user = (id, role, managerUserId = null, extra = {}) => ({ id, role, fullName: id, email: `${id}@example.test`, active: true, managerUserId, ...extra });

test('admin sees every RM and exactly the salespeople assigned by account ID', () => {
  const users = [user('admin', 'admin'), user('rm-b', 'rm'), user('rm-a', 'rm'), user('rep-b', 'salesperson', 'rm-b'), user('rep-a2', 'salesperson', 'rm-a'), user('rep-a1', 'salesperson', 'rm-a')];
  const before = structuredClone(users);
  const result = buildReportingStructure(users);
  assert.deepEqual(result.admins.map(person => person.id), ['admin']);
  assert.deepEqual(result.groups.map(group => [group.manager.id, group.members.map(person => person.id)]), [['rm-a', ['rep-a1', 'rep-a2']], ['rm-b', ['rep-b']]]);
  assert.deepEqual(result.totals, { admins: 1, rms: 2, activeRms: 2, salespeople: 3, activeSalespeople: 3, assigned: 3, unassigned: 0 });
  assert.deepEqual(users, before);
});

test('duplicate RM names remain separate; inactive and pending accounts retain their actual reporting lines', () => {
  const users = [user('admin-a', 'admin'), user('admin-b', 'admin', null, { active: false }), user('rm-a', 'rm', null, { fullName: 'Same Name' }), user('rm-b', 'rm', null, { fullName: 'Same Name', active: false }), user('rep-a', 'salesperson', 'rm-a'), user('rep-b', 'salesperson', 'rm-b', { active: false, invitationPending: true })];
  const result = buildReportingStructure(users);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups.find(group => group.manager.id === 'rm-a').members[0].id, 'rep-a');
  assert.equal(result.groups.find(group => group.manager.id === 'rm-b').members[0].id, 'rep-b');
  assert.equal(result.totals.admins, 2);
  assert.equal(result.totals.activeRms, 1);
  assert.equal(result.totals.activeSalespeople, 1);
  assert.equal(result.totals.unassigned, 0);
});

test('missing, invalid-role and deleted-manager references are explicitly unassigned; empty RMs are visible', () => {
  const users = [user('admin', 'admin'), user('empty-rm', 'rm'), user('none', 'salesperson'), user('missing', 'salesperson', 'missing-rm'), user('wrong-role', 'salesperson', 'admin')];
  const result = buildReportingStructure(users);
  assert.deepEqual(result.groups[0].members, []);
  assert.equal(result.totals.assigned, 0);
  assert.equal(result.totals.unassigned, 3);
  assert.deepEqual(result.unassigned.map(person => person.id), ['missing', 'none', 'wrong-role']);
  assert.equal(new Set([...result.groups.flatMap(group => group.members), ...result.unassigned].map(person => person.id)).size, result.totals.salespeople);
});

test('empty structure reports zero counts rather than inventing an administrator or manager', () => {
  const result = buildReportingStructure([]);
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.admins, []);
  assert.deepEqual(result.unassigned, []);
  assert.equal(Object.values(result.totals).reduce((sum, count) => sum + count, 0), 0);
});
