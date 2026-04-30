const AUTH_STORAGE_KEY = "flowtime_auth";

const readStorage = () => {
  try {
    const value = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const writeStorage = (value) => {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error(error);
  }
};

export const getStoredAuth = () => readStorage();

export const setStoredAuth = (auth) => writeStorage(auth);

export const clearStoredAuth = () => window.localStorage.removeItem(AUTH_STORAGE_KEY);
