// Boilerplate now for testing

"use strict";

    // game port, defaults to 3000
var port = process.env.port || 3000,

    // static files live here, will be served by express
    gameDirectory = __dirname || "/public",

    // mongodb address including database name
    mongodbURL = process.env.MONGOHQ_URL || "mongodb://localhost/asteroidsserver01",

    // This looks super-duper top secret
    sessionSecret = process.env.SESSION_SECRET || "G1antW@rtyT0adsAr3H0pp1ing",

    // Load our dependencies
    flash = require('connect-flash'), // adds req.flash() to Express 3.0, passport needs it
    express = require('express'),
    mongodb = require('mongodb'),
    passport = require('passport'),

    // Passport strategies
    LocalStrategy = require('passport-local').Strategy,

    // Initialize the express server
    app = express();

app.configure(function() {
  // Views and routes
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.static(gameDirectory));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: sessionSecret }));
  app.use(flash()); // initialize flash before passport
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});

// Passport session setup and teardown
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Setup dev and prod error handlers. Dev is default.
app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function() {
  app.use(express.errorHandler());
});

// Utility method for logging
function getUserNameFromReq(req) {
  if (req && req.user && req.user.username) {
    return req.user.username;
  }
  return 'unknown';
}

// ejs template authentication routes
app.get('/', function(req, res) {
  console.log('user: ' + getUserNameFromReq(req) + ' requested /');
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res) {
  console.log('user: ' + getUserNameFromReq(req) + ' requested /account');
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res) {
  console.log('user: ' + getUserNameFromReq(req) + ' requested /login');
  res.render('login', { user: req.user, message: req.flash('error') });
});

app.get('/logout', function(req, res) {
  console.log('user: ' + getUserNameFromReq(req) + ' requested /logout');
  req.logout();
  res.redirect('/');
});

//app.get('/dbtesting', function(req, res) {
//  console.log('user: ' + getUserNameFromReq(req) + ' requested /dbtesting');
//  res.render('dbtesting', {user: req.user, message: res.message })
//});

// Test for user authentication via passport and reroute if needed.
// If authentication passes, the route succeeds, otherwise redirects to login.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    console.log('user: ' + getUserNameFromReq(req) + ' is authenticated');
    return next();
  }

  // not logged in, off to login page you go
  console.log('user: ' + getUserNameFromReq(req) + ' is not authenticated, requesting /login.');
  res.redirect('/login');
}

// Local user name and password log in via passport-local module
// Testing testing 1, 2, 3 here, really wants to be in a database...
var users = [
  { id: 1, username: 'toady-frog', password: 'hop', email: 'toady-frog@hophophop.com' },
  { id: 2, username: 'rattlesnake', password: 'rattle', email: 'rattlesnake@hiss.com' },
  { id: 3, username: 'goat', password: 'baaa', email: 'goat@smelly.com' }
];

// Find someone from our users above by id
function findById(id, callback) {
  var idx = id -1;
  if (users[idx]) {
    console.log('..findById returned ' + users[idx]);
    callback(null, users[idx]);
  } else {
    console.log('..findById did not find user with id ' + id);
    callback(new Error('User ' + id + ' does not exist.'));
  }
}

// Find someone by our users above by username
function findByUsername(username, callback) {
  var i = 0,
      len = users.length,
      user;
  for (i, len; i < len; i++) {
    user = users[i];
    if (user.username === username) {
      console.log('..findByUsername found user ' + username);
      return callback(null, user);
    } else {
      console.log('..findByUsername did not find user ' + username);
      return callback(null, null);
    }
  }
}

// Local verification of username and password via passport
passport.use(new LocalStrategy(
  function(username, password, done) {
    // async
    process.nextTick(function() {
      // try to find someone with the supplied username and password.
      // return the authenticated user, or an error message if not found
      findByUsername(username, function(err, user) {
        if (err) {
          return done(err);
        }
        if (!user) {
          return done(null, false, { message: 'Unknown user: ' + username });
        }
        if (user.password != password) {
          return done(null, false, { message: 'Password incorrect' });
        }
        return done(null, user);
      });
    });
  }
));

// In response to a form post, have passport authenticate the request.
app.post('/login',
         passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
                               function(req, res) {
                                 console.log('..passport authenticate redirecting to /');
                                 res.redirect('/');
                               });

// Start the server on port 3000
app.listen(port, function() {
  console.log('App server listening on port %d in %s mode',
              port, app.settings.env);
});

// mongodb database methods
var dbMethods = { };

mongodb.connect( mongodbURL, { }, function(error, db) {
  if (error) {
    console.log('mongodb.connect could not connect to database');
    console.log(error);
    return;
  }

  console.log('mongodb connected');

  // grab users from the db and do stuff
  db.collection('users', function(err, collection) {
    if (err) {
      console.log('could not get users collection in the mongodb database.');
      console.log(err);
      return;
    }
    console.log('mongodb.db.collection users found, methods being setup');

    // find a user in the db
    dbMethods.fetchUser = function(userName, callback) {
      if (!userName) {
        console.log('..dbMethods.fetchUser did not find user ' + userName);
        callback(false);
        return;
      }

      collection.findOne( {user: userName}, function(error, userEntry) {
        if (!userEntry) {
          userEntry = {
            user_name: userName,
            user_score: 0
          };
        }
        console.log('..dbMethods.fetchUser.collection.findOne found ' + userEntry.user_name +
                    ', ' + userEntry.user_score);
        callback(userEntry);
      });
    };

    // set a user's score in the db
    dbMethods.setUserScore = function(userEntry, callback) {
      if (!userEntry) {
        console.log('..dbMethods.setUserScore did not find userEntry ' + userEntry);
        callback(false);
        return;
      }
      collection.save(userEntry, function() {
        console.log('..dbMethods.setUserScore.collection.save for ' + userEntry);
        callback(userEntry);
      });
    };

    // get the top ten scores in the database
    dbMethods.topTen = function(callback) {
      collection.find()
                .sort({user_score: -1})
                .limit(10)
                .toArray(function(error, results) {
                          var output = [ ],
                              i;
                          for (i in results) {
                            output.push({
                              user_name: results[i].user_name,
                              user_score: results[i].user_score
                            });
                          }
                          callback(output);
                        });
    };

    dbMethods.clearUsers = function(callback) {
      collection.drop(callback);
    };

  }); // dbcollection

}); // mongodb connect

// main launch page
function main_page(req, res) {
  var userName,
      userScore;

  console.log('addscore called, directed to main_page ');

  // if we have post data, create or update a database entry
  if (req.body.user_name) {
    // the body parser will have the data
    userName = req.body.user_name;
    userScore = parseInt(req.body.user_score);
    console.log('setting score for ' + userName + ', ' + userScore);

    //attempt to fetch existing user
    dbMethods.fetchUser(userName, function(userEntry) {
      // Update the score and database collection
      userEntry.user_score = userScore;
      dbMethods.setUserScore(userEntry, function(success) {
        if (success) {
          console.log('new user ' + userName +
                      ' and score ' + userScore + ' added to the database.');
        } else {
          console.log('unable to add new user ' + userName +
                      ' and score ' + userScore + ' to the database.')
        }
      });
    });
  }

  // display the main page
  res.redirect('../public/dbtests.html');
}

// post data handling for the add score form
app.get('/addscore', main_page);
app.post('/addscore', main_page);

app.get('/top-ten', function(req, res) {
  console.log('top 10');
  dbMethods.topTen(function(results) {
    res.json( {users: results});
  });
});

app.get('/clearusers', function(req, res) {
  console.log('you pushed the Big Red Button.');
  dbMethods.clearUsers(function(results) {
    res.json({ users: results});
  });
});

// Return our App module
module.exports = app;