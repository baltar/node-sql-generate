var should = require('should'),
	fs = require('fs'),
	path = require('path'),
	util = require('util'),
	generate = require('../');

describe('generator', function() {
	describe('argument validation', function() {
		it('should explode if dsn is missing', function(done) {
			generate({}, function(err) {
				err.should.be.instanceOf(Error);
				err.should.have.property('message', 'options.dsn is required');
				done();
			});
		});

		it('should explode if dialect is missing', function(done) {
			generate({ dsn: 'foo!' }, function(err) {
				err.should.be.instanceOf(Error);
				err.should.have.property('message', 'options.dialect is required');
				done();
			});
		});

		it('should explode if dialect is unsupported', function(done) {
			generate({ dsn: 'foo!', dialect: 'bar' }, function(err) {
				err.should.be.instanceOf(Error);
				err.should.have.property('message', 'options.dialect must be either "mysql" or "pg"');
				done();
			});
		});

		it('should explode if database is missing and not part of the DSN', function(done) {
			generate({ dsn: 'mysql://foo:bar@localhost/' }, function(err) {
				err.should.be.instanceOf(Error);
				err.should.have.property('message', 'options.database is required if it is not part of the DSN');
				done();
			});
		});
	});

	var database = 'node_sql_generate',
		dialects = {
			mysql: 'mysql://sqlgenerate:password@localhost/',
			pg: 'postgres://sqlgenerate:password@localhost/postgres'
		},
		getExpected = function(name) {
			return fs.readFileSync(path.join(__dirname, 'expected', name + '.js'), 'utf8');
		},
		removeAutogeneratedComment = function(string) {
			return string.replace(/\/\/ autogenerated.+?(\r\n|\n)/, '');
		},
		options = function(options) {
			return util._extend(util._extend({}, defaults), options);
		};

	for (var dialect in dialects) {
		var dsn = dialects[dialect],
			db = require(dialect),
			defaults = {
				dsn: dsn,
				dialect: dialect
			},
			client;

		describe('for ' + dialect, function() {
			var realDatabase;
			switch (dialect) {
				case 'mysql':
					defaults.database = realDatabase = database;
					break;
				case 'pg':
					defaults.database = realDatabase = 'postgres';
					defaults.schema = database;
					break;
			}

			before(function(done) {
				function runScripts(err) {
					should.not.exist(err);
					var sql = fs.readFileSync(path.join(__dirname, 'scripts', dialect + '-before.sql'), 'utf8');
					client.query(sql, done);
				}

				switch (dialect) {
					case 'mysql':
						client = db.createConnection(dsn + '?multipleStatements=true');
						client.connect(runScripts);
						break;
					case 'pg':
						client = new db.Client(dsn);
						client.connect(runScripts);
						break;
				}
			});

			after(function(done) {
				function runScripts(callback) {
					var sql = fs.readFileSync(path.join(__dirname, 'scripts', dialect + '-after.sql'), 'utf8');
					client.query(sql, callback);
				}

				switch (dialect) {
					case 'mysql':
						runScripts(function(scriptErr) {
							client.end(function(err) {
								done(scriptErr || err);
							});
						});
						break;
					case 'pg':
						runScripts(function(scriptErr) {
							client.end();
							done(scriptErr);
						});
						break;
				}
			});

			it('with dialect embedded in dsn', function(done) {
				generate({ dsn: dsn, schema: database }, function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('defaults');
					removeAutogeneratedComment(stats.buffer).should.equal(expected);
					done();
				});
			});

			it('with defaults', function(done) {
				generate(defaults, function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('defaults');
					removeAutogeneratedComment(stats.buffer).should.equal(expected);
					done();
				});
			});

			it('with custom indentation character', function(done) {
				generate(options({ indent: '  ' }), function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('indent');
					removeAutogeneratedComment(stats.buffer).should.equal(expected);
					done();
				});
			});

			it('with camel cased name', function(done) {
				generate(options({ camelize: true }), function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('camelize');
					removeAutogeneratedComment(stats.buffer).should.equal(expected);
					done();
				});
			});

			it('with custom EOL character', function(done) {
				generate(options({ eol: '\r\n' }), function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('eol');
					removeAutogeneratedComment(stats.buffer).should.equal(expected);
					done();
				});
			});

			it('with prepended text', function(done) {
				generate(options({ prepend: '//hello world' }), function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('prepend');
					removeAutogeneratedComment(stats.buffer).should.equal(expected);
					done();
				});
			});

			it('with appended text', function(done) {
				generate(options({ append: '//hello world' }), function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('append');
					removeAutogeneratedComment(stats.buffer).should.equal(expected);
					done();
				});
			});

			it('with omitted comments', function(done) {
				generate(options({ omitComments: true }), function(err, stats) {
					should.not.exist(err);
					var expected = getExpected('omit-comments');
					stats.buffer.should.equal(expected);
					done();
				});
			});
		});
	}
});