const supertest = require("supertest");
const {app, server} = require("../index");
const api = supertest(app);
const Blog = require("../models/blog");
const User = require("../models/user");
const {
  initialBlogs,
  nonExistingId,
  blogsInDb,
  usersInDb
} = require("./test_helper");
const jwt = require("jsonwebtoken");

describe("when there are initially some blogs saved", async () => {
  beforeAll(async () => {
    await Blog.remove({});

    const blogObjects = initialBlogs.map((blog) => new Blog(blog));
    const promiseArray = blogObjects.map((blog) => blog.save());
    await Promise.all(promiseArray);
  });

  test("all blogs are returned as json by GET /api/blogs", async () => {
    const blogsInDatabase = await blogsInDb();
    const response = await api
      .get("/api/blogs")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(response.body.length).toBe(blogsInDatabase.length);

    const returnedTitles = response.body.map((n) => n.title);
    blogsInDatabase.forEach((blog) => {
      expect(returnedTitles).toContain(blog.title);
    });
  });

  test("GET /api/blogs/ returns a specific blog within the returned blogs", async () => {
    const blogsInDatabase = await blogsInDb();
    const aBlog = blogsInDatabase[0];

    const response = await api
      .get("/api/blogs")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    const contents = response.body[0];
    expect(contents.title).toContain(aBlog.title);
  });

  test("GET /api/blogs/:id fails with a malformatted id", async () => {
    const blogsInDatabase = await blogsInDb();

    const response = await api
      .get("/api/blogs/bl0g1")
      .expect(400)
      .expect("Content-Type", /application\/json/);

    expect(response.body.error).toContain("malformatted id");
  });

  test("GET /api/blogs/:id fails with a correct id when it is not found", async () => {
    const blogsInDatabase = await blogsInDb();

    const response = await api
      .get("/api/blogs/5a55018f038c146320df2199")
      .expect(404)
  });
});

describe("addition of a new blog", async () => {
  test.skip("POST /api/blogs succeeds with valid data", async () => {
    const blogsAtBeginningOfOperation = await blogsInDb();

    const newBlog = {
      user: {
        _id: "5a550161038c146320df218f",
        username: "ounou",
        name: "Taichi Ounou"
      },
      comments: [],
      title: "So you want to be a wizard",
      author: "Julia Evans",
      url: "https://speakerdeck.com/jvns/so-you-want-to-be-a-wizard/",
      likes: 3
    };

    await api
      .post("/api/blogs")
      .send(newBlog)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const blogsAfterOperation = await blogsInDb();

    expect(blogsAfterOperation.length).toBe(
      blogsAtBeginningOfOperation.length + 1
    );

    const titles = blogsAfterOperation.map((blog) => blog.title);
    expect(titles).toContain("So you want to be a wizard");
  });

  test.skip("POST /api/blogs with undefined likes succeeds and likes are set to zero", async () => {
    const newBlog = {
      title: "Pagination in Web Forms",
      author: "Janet M. Six",
      url:
        "https://www.uxmatters.com/mt/archives/2010/03/pagination-in-web-forms-evaluating-the-effectiveness-of-web-forms.php"
    };

    await api
      .post("/api/blogs")
      .send(newBlog)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const blogsAfterOperation = await blogsInDb();

    const likelessBlog = blogsAfterOperation.filter(
      (blog) => blog.title === "Pagination in Web Forms"
    );
    expect(likelessBlog[0].likes).toBe(0);
  });

  test.skip("POST /api/blogs fails without title and url information", async () => {
    const blogsAtBeginningOfOperation = await blogsInDb();

    const blogWithNoTitle = {
      author: "Kyle Simpson",
      url: "https://github.com/getify/You-Dont-Know-JS",
      likes: 9
    };

    await api
      .post("/api/blogs")
      .send(blogWithNoTitle)
      .expect(400);

    const blogWithNoUrl = {
      title: "You-Dont-Know-JS",
      author: "Kyle Simpson",
      likes: 9
    };

    await api
      .post("/api/blogs")
      .send(blogWithNoUrl)
      .expect(400);

    const blogWithBothMissing = {
      author: "Kyle Simpson",
      likes: 9
    };

    await api
      .post("/api/blogs")
      .send(blogWithBothMissing)
      .expect(400);

    const blogsAfterOperation = await blogsInDb();

    expect(blogsAfterOperation.length).toBe(blogsAtBeginningOfOperation.length);
  });
});

describe("deletion of a blog", async () => {
  let addedBlog;

  beforeAll(async () => {
    addedBlog = new Blog({
      title: "Deleting blogs by identification",
      author: "Meself",
      url: "http://www.deletebyid.com",
      likes: 5
    });
    await addedBlog.save();

    const user = new User({
      username: "jbond",
      password: "bondjamesbond",
      name: "James X. Bond",
      adult: true
    });
    await api.post("/api/users").send(user);

    const otherUser = new User({
      username: "joulupukki",
      password: "korvatunturi",
      name: "Kris Kringle",
      adult: true
    });
    await api.post("/api/users").send(otherUser);
  });

  test("DELETE /api/blogs/:id succeeds with proper status code", async () => {
    const blogsAtBeginningOfOperation = await blogsInDb();

    await api.delete(`/api/blogs/${addedBlog._id}`).expect(204);

    const blogsAfterOperation = await blogsInDb();
    const titles = blogsAfterOperation.map((blog) => blog.title);

    expect(titles).not.toContain(addedBlog.title);
    expect(blogsAfterOperation.length).toBe(
      blogsAtBeginningOfOperation.length - 1
    );
  });

  test("DELETE /api/blogs/:id fails if not blog's original adder", async () => {
    const usersInDatabase = await usersInDb();
    const bond = usersInDatabase.filter((user) => user.username === "jbond");
    const pukki = usersInDatabase.filter(
      (user) => user.username === "joulupukki"
    );

    const pukkiCredentials = {
      username: "joulupukki",
      password: "korvatunturi"
    };

    const loginPukki = await api
      .post("/api/login")
      .send(pukkiCredentials)
      .expect(200)
      .expect("Content-Type", /application\/json/);

    const pukkiToken = loginPukki.body.token;

    const agentBlog = new Blog({
      user: bond[0]._id,
      title: "The Secret Life of a Secret Agent",
      author: "Secret",
      url: "http://www.not-gonna-tell.com",
      likes: 7
    });

    await agentBlog.save();

    const blogsAtBeginningOfOperation = await blogsInDb();
    const deletoitavaBlogi = blogsAtBeginningOfOperation.filter(
      (blog) => blog.author === "Secret"
    );

    await api
      .delete(`/api/blogs/${deletoitavaBlogi[0]._id}`)
      .set("Authorization", "bearer " + pukkiToken)
      .expect(401)
      .expect("Content-Type", /application\/json/);

    const blogsAfterOperation = await blogsInDb();

    expect(blogsAfterOperation.length).toBe(blogsAtBeginningOfOperation.length);
  });

  test("DELETE /api/blogs/:id is successful for blog's original adder", async () => {
    const usersInDatabase = await usersInDb();
    const bond = usersInDatabase.filter((user) => user.username === "jbond");

    const bondCredentials = {
      username: "jbond",
      password: "bondjamesbond"
    };

    const loginBond = await api
      .post("/api/login")
      .send(bondCredentials)
      .expect(200)
      .expect("Content-Type", /application\/json/);

    const bondToken = loginBond.body.token;

    const agentBlog = new Blog({
      user: bond[0]._id,
      title: "More Secrets from the Life of a Secret Agent",
      author: "Secret Again",
      url: "http://www.still-not-gonna-tell.com",
      likes: 8
    });

    await agentBlog.save();

    const blogsAtBeginningOfOperation = await blogsInDb();
    const deletoitavaBlogi = blogsAtBeginningOfOperation.filter(
      (blog) => blog.author === "Secret Again"
    );

    await api
      .delete(`/api/blogs/${deletoitavaBlogi[0]._id}`)
      .set("Authorization", "bearer " + bondToken)
      .expect(204);

    const blogsAfterOperation = await blogsInDb();

    expect(blogsAfterOperation.length).toBe(
      blogsAtBeginningOfOperation.length - 1
    );
  });
});

describe("creating new users", async () => {
  test("POST /api/users fails if the username or password is less than 3 characters", async () => {
    const usersBeforeOperation = await usersInDb();
    const userWithTooShortUsername = new User({
      username: "ma",
      password: "secret",
      name: "Maxwell Smart",
      adult: true
    });

    const shortUsername = await api
      .post("/api/users")
      .send(userWithTooShortUsername)
      .expect(400)
      .expect("Content-Type", /application\/json/);

    expect(shortUsername.text).toContain(
      "username and password must have at least 3 characters"
    );

    const userWithTooShortPassword = new User({
      username: "maxwell",
      password: "se",
      name: "Maxwell Smart",
      adult: true
    });

    const shortPassword = await api
      .post("/api/users")
      .send(userWithTooShortUsername)
      .expect(400)
      .expect("Content-Type", /application\/json/);

    expect(shortPassword.text).toContain(
      "username and password must have at least 3 characters"
    );

    const usersAfterOperation = await usersInDb();
    expect(usersBeforeOperation.length).toBe(usersAfterOperation.length);
  });

  test("POST /api/users fails if the username has already been taken", async () => {
    const newUser = new User({
      username: "humppa",
      password: "humphamp",
      name: "Tari Kapio",
      adult: true
    });

    await api.post("/api/users").send(newUser);

    const usersBeforeOperation = await usersInDb();

    const userWithTakenUsername = new User({
      username: "humppa",
      password: "randommm",
      name: "Teppo Mattiseppo",
      adult: false
    });

    const result = await api
      .post("/api/users")
      .send(userWithTakenUsername)
      .expect(400)
      .expect("Content-Type", /application\/json/);

    expect(result.text).toContain("username must be unique");

    const usersAfterOperation = await usersInDb();
    expect(usersBeforeOperation.length).toBe(usersAfterOperation.length);
  });

  test("POST /api/users uses default adult value of true if undefined", async () => {
    const adultUser = new User({
      username: "rockon",
      password: "rockers",
      name: "Herra Badding"
    });

    const result = await api
      .post("/api/users")
      .send(adultUser)
      .expect("Content-Type", /application\/json/);

    const usersAfterOperation = await usersInDb();
    const adultOrNot = usersAfterOperation.filter(
      (user) => user.name === "Herra Badding"
    );

    expect(adultOrNot[0].adult).toBe(true);
  });
});

describe("finding users", async () => {
  test.skip("GET /api/users returns all users as json", async () => {
    const usersBeforeOperation = await usersInDb();
    const user = new User({
      username: "newmaxwell",
      password: "secret",
      name: "Maxwell Smart",
      adult: true
    });

    const createdUser = await api
      .post("/api/users")
      .send(user)
      .expect("Content-Type", /application\/json/);

    const allUsers = await api.get("/api/users");

    const usersAfterOperation = await usersInDb();

    expect(usersAfterOperation.length).toBe(usersBeforeOperation.length + 1);
  });
});

afterAll(() => {
  server.close();
});
