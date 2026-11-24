// The goals store: adding a goal (including one the app counts itself), editing one, and what an edit may not change.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ collection: name })),
  addDoc: jest.fn(async () => ({ id: 'new-goal' })),
  updateDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  doc: jest.fn((db, collection, id) => ({ collection, id })),
  getDocs: jest.fn(),
  query: jest.fn((...args) => ({ args })),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
}));

const firestore = require('firebase/firestore');
const { useGoalsStore } = require('../store/goalsStore');

const seed = () => useGoalsStore.setState({
  goals: [
    { id: 'g1', userId: 'u1', title: 'Lose 10 lbs', current: 2, target: 10, unit: 'lbs', deadline: '2026-12-31', completed: false, metric: null, period: null },
    { id: 'g2', userId: 'u1', title: 'Train', current: 0, target: 3, unit: 'workouts', deadline: null, completed: false, metric: 'workouts', period: 'week' },
  ],
});

beforeEach(() => { jest.clearAllMocks(); seed(); });

describe('addGoal', () => {
  it('saves a goal kept by hand with no tracking, as it always did', async () => {
    const id = await useGoalsStore.getState().addGoal({ uid: 'u1', title: 'Read', target: 10, unit: 'books' });
    expect(id).toBe('new-goal');
    expect(firestore.addDoc).toHaveBeenCalledWith({ collection: 'goals' }, {
      userId: 'u1', title: 'Read', current: 0, target: 10, unit: 'books', deadline: null, completed: false, metric: null, period: null, createdAt: 'SERVER_TIME',
    });
    expect(useGoalsStore.getState().goals[0]).toEqual({
      id: 'new-goal', userId: 'u1', title: 'Read', current: 0, target: 10, unit: 'books', deadline: null, completed: false, metric: null, period: null,
    });
  });

  it('saves what the app is to count, and over when', async () => {
    await useGoalsStore.getState().addGoal({ uid: 'u1', title: 'Train', target: 3, unit: 'workouts', metric: 'workouts', period: 'month' });
    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({ metric: 'workouts', period: 'month', unit: 'workouts' });
    expect(useGoalsStore.getState().goals[0]).toMatchObject({ metric: 'workouts', period: 'month' });
  });

  it('still takes the goal the Coach adds (title, target, unit and a deadline)', async () => {
    await useGoalsStore.getState().addGoal({ uid: 'u1', title: 'Run a 5K', target: 5, unit: 'km', deadline: '2027-01-10' });
    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({ deadline: '2027-01-10', completed: false, metric: null });
  });

  it('can be saved already complete', async () => {
    await useGoalsStore.getState().addGoal({ uid: 'u1', title: 'Done', target: 1, current: 1, completed: true });
    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({ completed: true, current: 1 });
  });

  it('needs someone signed in', async () => {
    await expect(useGoalsStore.getState().addGoal({ title: 'x', target: 1 })).rejects.toThrow('Not authenticated');
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});

describe('updateGoal', () => {
  it('changes the fields it is given, in Firestore and in the store, and leaves the other goal alone', async () => {
    const before = useGoalsStore.getState().goals[1];
    await useGoalsStore.getState().updateGoal('g1', { title: 'Lose 12 lbs', target: 12, current: 5 });
    expect(firestore.updateDoc).toHaveBeenCalledWith({ collection: 'goals', id: 'g1' }, { title: 'Lose 12 lbs', target: 12, current: 5 });
    const [g1, g2] = useGoalsStore.getState().goals;
    expect(g1).toMatchObject({ id: 'g1', title: 'Lose 12 lbs', target: 12, current: 5, unit: 'lbs', deadline: '2026-12-31', userId: 'u1' });
    expect(g2).toBe(before);
  });

  it('can mark a goal complete, and can change what it tracks', async () => {
    await useGoalsStore.getState().updateGoal('g1', { completed: true, current: 10 });
    await useGoalsStore.getState().updateGoal('g2', { metric: 'calories', period: 'month', unit: 'cal' });
    expect(useGoalsStore.getState().goals[0]).toMatchObject({ completed: true, current: 10 });
    expect(useGoalsStore.getState().goals[1]).toMatchObject({ metric: 'calories', period: 'month', unit: 'cal' });
  });

  it('ignores the owner, the deadline and anything else that is not for editing', async () => {
    await useGoalsStore.getState().updateGoal('g1', { userId: 'someone-else', deadline: '2030-01-01', createdAt: 'x', id: 'g9', title: 'Renamed' });
    expect(firestore.updateDoc).toHaveBeenCalledWith({ collection: 'goals', id: 'g1' }, { title: 'Renamed' });
    expect(useGoalsStore.getState().goals[0]).toMatchObject({ id: 'g1', userId: 'u1', deadline: '2026-12-31', title: 'Renamed' });
  });

  it('does nothing when there is nothing to change', async () => {
    await useGoalsStore.getState().updateGoal('g1', { userId: 'someone-else' });
    await useGoalsStore.getState().updateGoal('g1', {});
    await useGoalsStore.getState().updateGoal('g1');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('keeps the store as it was when Firestore refuses', async () => {
    firestore.updateDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(useGoalsStore.getState().updateGoal('g1', { title: 'Nope' })).rejects.toThrow('permission-denied');
    expect(useGoalsStore.getState().goals[0].title).toBe('Lose 10 lbs');
  });
});

describe('deleteGoal and updateGoalProgress (unchanged)', () => {
  it('deletes a goal', async () => {
    await useGoalsStore.getState().deleteGoal('g1');
    expect(firestore.deleteDoc).toHaveBeenCalledWith({ collection: 'goals', id: 'g1' });
    expect(useGoalsStore.getState().goals.map((g) => g.id)).toEqual(['g2']);
  });

  it('updates the progress of a goal', async () => {
    await useGoalsStore.getState().updateGoalProgress('g2', 2);
    expect(firestore.updateDoc).toHaveBeenCalledWith({ collection: 'goals', id: 'g2' }, { current: 2 });
    expect(useGoalsStore.getState().goals[1].current).toBe(2);
  });
});
