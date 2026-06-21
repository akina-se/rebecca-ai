const getJSTDate = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
};

module.exports = { getJSTDate };
