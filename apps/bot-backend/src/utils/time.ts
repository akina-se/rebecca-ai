/**
 * Retrieves the current date and time localized to Japan Standard Time (JST).
 *
 * This is crucial for ensuring that chronological operations (e.g., scheduling, logging)
 * remain consistent regardless of the server's local timezone setting.
 *
 * @returns A `Date` object representing the current time in the 'Asia/Tokyo' timezone.
 */
const getJSTDate = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
};

export {  getJSTDate  };
