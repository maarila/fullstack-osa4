const dummy = (blogs) => {
  return 1;
};

const totalLikes = (blogs) => {
  return blogs.map((blog) => blog.likes).reduce((a, b) => {
    return a + b;
  }, 0);
};

module.exports = {
  dummy,
  totalLikes
};
