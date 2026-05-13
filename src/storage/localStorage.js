// Local storage system for dicrejart
// All data stored in localStorage for in-memory persistence

const STORAGE_KEYS = {
  ITEMS: 'dicrejart_items',
  MOVEMENTS: 'dicrejart_movements',
  PERSONNEL: 'dicrejart_personnel',
  BRANDS: 'dicrejart_brands',
  LOCATIONS: 'dicrejart_locations'
};

// Helper functions
const getStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return [];
  }
};

const setStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key}:`, e);
  }
};

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// Items
export const getItems = () => getStorage(STORAGE_KEYS.ITEMS);
export const setItems = (items) => setStorage(STORAGE_KEYS.ITEMS, items);
export const addItem = (item) => {
  const items = getItems();
  const newItem = { ...item, id: generateId(), createdAt: new Date().toISOString() };
  items.push(newItem);
  setItems(items);
  return newItem;
};
export const updateItem = (id, updates) => {
  const items = getItems();
  const index = items.findIndex(i => i.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    setItems(items);
    return items[index];
  }
  return null;
};
export const deleteItem = (id) => {
  const items = getItems();
  const filtered = items.filter(i => i.id !== id);
  setItems(filtered);
};

// Movements
export const getMovements = () => getStorage(STORAGE_KEYS.MOVEMENTS);
export const setMovements = (movements) => setStorage(STORAGE_KEYS.MOVEMENTS, movements);
export const addMovement = (movement) => {
  const movements = getMovements();
  const newMovement = { 
    ...movement, 
    id: generateId(), 
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleString()
  };
  movements.unshift(newMovement); // Add to beginning
  setStorage(STORAGE_KEYS.MOVEMENTS, movements);
  return newMovement;
};
export const updateMovement = (id, updates) => {
  const movements = getMovements();
  const index = movements.findIndex(m => m.id === id);
  if (index !== -1) {
    movements[index] = { ...movements[index], ...updates };
    setStorage(STORAGE_KEYS.MOVEMENTS, movements);
    return movements[index];
  }
  return null;
};

// Personnel
export const getPersonnel = () => getStorage(STORAGE_KEYS.PERSONNEL);
export const setPersonnel = (personnel) => setStorage(STORAGE_KEYS.PERSONNEL, personnel);
export const addPerson = (person) => {
  const personnel = getPersonnel();
  const newPerson = { ...person, id: generateId(), createdAt: new Date().toISOString() };
  personnel.push(newPerson);
  setStorage(STORAGE_KEYS.PERSONNEL, personnel);
  return newPerson;
};
export const deletePerson = (id) => {
  const personnel = getPersonnel();
  const filtered = personnel.filter(p => p.id !== id);
  setStorage(STORAGE_KEYS.PERSONNEL, filtered);
};

// Brands
export const getBrands = () => getStorage(STORAGE_KEYS.BRANDS);
export const setBrands = (brands) => setStorage(STORAGE_KEYS.BRANDS, brands);
export const addBrand = (name) => {
  const brands = getBrands();
  if (brands.find(b => b.name === name)) return null;
  const newBrand = { id: generateId(), name, createdAt: new Date().toISOString() };
  brands.push(newBrand);
  setStorage(STORAGE_KEYS.BRANDS, brands);
  return newBrand;
};
export const deleteBrand = (id) => {
  const brands = getBrands();
  const filtered = brands.filter(b => b.id !== id);
  setStorage(STORAGE_KEYS.BRANDS, filtered);
};

// Locations
export const getLocations = () => getStorage(STORAGE_KEYS.LOCATIONS);
export const setLocations = (locations) => setStorage(STORAGE_KEYS.LOCATIONS, locations);
export const addLocation = (name, zone = '') => {
  const locations = getLocations();
  const newLocation = { id: generateId(), name, zone, createdAt: new Date().toISOString() };
  locations.push(newLocation);
  setStorage(STORAGE_KEYS.LOCATIONS, locations);
  return newLocation;
};
export const deleteLocation = (id) => {
  const locations = getLocations();
  const filtered = locations.filter(l => l.id !== id);
  setStorage(STORAGE_KEYS.LOCATIONS, filtered);
};

// Clear all data
export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
};

// Get stats
export const getStats = () => {
  const items = getItems();
  const movements = getMovements();
  const critical = items.filter(i => (i.qty || 0) <= (i.threshold || 0)).length;
  
  // Activity for last 7 days
  const last7Days = [6, 5, 4, 3, 2, 1, 0].map(i => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    return d;
  });
  
  const activity = last7Days.map(day => {
    const dayMovements = movements.filter(m => {
      const moveDate = new Date(m.timestamp);
      return moveDate.toDateString() === day.toDateString();
    });
    return {
      name: day.toLocaleDateString('es-ES', { weekday: 'short' }),
      movimientos: dayMovements.length
    };
  });
  
  return {
    items: items.length,
    movements: movements.length,
    critical,
    activity
  };
};
