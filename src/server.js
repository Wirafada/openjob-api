require('dotenv').config();

const express = require('express');

const errorHandler = require('./middlewares/errorHandler');

const usersRouter = require('./routes/users');
const authenticationsRouter = require('./routes/authentications');
const profileRouter = require('./routes/profile');
const profileApplicationsRouter = require('./routes/profileApplications');
const companiesRouter = require('./routes/companies');
const categoriesRouter = require('./routes/categories');
const jobsRouter = require('./routes/jobs');
const bookmarksRouter = require('./routes/bookmarks');
const applicationsRouter = require('./routes/applications');

const app = express();
const host = process.env.HOST;
const port = Number(process.env.PORT);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'OpenJob API berjalan',
  });
});

app.use('/users', usersRouter);
app.use('/authentications', authenticationsRouter);

app.use('/profile', profileApplicationsRouter);
app.use('/profile', profileRouter);

app.use('/companies', companiesRouter);
app.use('/categories', categoriesRouter);
app.use('/jobs', jobsRouter);
app.use('/applications', applicationsRouter);

// Router ini sudah mendefinisikan path lengkap bookmark.
app.use(bookmarksRouter);

app.use(errorHandler);

app.listen(port, host, () => {
  console.log(`Server berjalan di http://${host}:${port}`);
});