/**
 * Gets the current date and time in Japan Standard Time (JST).
 *
 * @returns {Date} A Date object representing the current time in the Asia/Tokyo timezone.
 */
const getJSTDate = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
};

export {  getJSTDate  };
