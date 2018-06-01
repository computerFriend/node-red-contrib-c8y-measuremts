// require in libs
var request = require('request'),
	queryString = require('query-string'),
	utf8 = require('utf8'),
	base64 = require('base-64');

// define constants
// NOTE: not using 'const' bc we want this node to be compatible with early ES versions (<ES6)
var	basePath = '/measurement/measurements'; // this is a constant, dependent on c8y
	// c8yInstanceName = 'sbdconnect.io'; // TODO: store in settings.js file

module.exports = function(RED) {

	function c8yMeasurements(n) {
		// Setup node
		RED.nodes.createNode(this, n);
		var node = this;

		this.ret = n.ret || "txt"; // default return type is text
		if (RED.settings.httpRequestTimeout) {
			this.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 60000;
		} else {
			this.reqTimeout = 60000;
		}

		var tenant = node.tenant;
		// var domain = tenant + '.' + c8yInstanceName;
		var domain = tenant; // NOTE temp soln

		// 1) Process inputs to Node
		this.on("input", function(msg) {

				node.status({
					fill: "blue",
					shape: "dot",
					text: "Fetching measurements..."
				});

				// Build query obj
				// TODO: add query params based on input: source(deviceId), timeRange, measurementId
				var reqQuery = {};
				if (node.deviceId) {
					reqQuery.source = node.deviceId;
					basePath += 'series';
				}
				if (node.startDate && node.endDate) { // TODO find out dateFormat; also look into dateinput widget (html) for the node, instead of string input
					reqQuery.dateFrom = node.startDate;
					reqQuery.dateTo = node.endDate;
				}

				// Stringify query obj
				var thisQueryString = queryString.stringify(reqQuery);

				// Adding auth header // TODO: develop a more secure way to do this
				var encodedCreds;
				if (this.credentials && this.credentials.user) {
					var rawCreds = tenant + '/' + this.credentials.user + ':' + this.credentials.password;
					var byteCreds = utf8.encode(rawCreds);
					encodedCreds = base64.encode(byteCreds);
				} // else if: TODO: check for creds in settings.js file
				// encodedCreds = value.from.settings
				else {
					// TODO: log error: missing credentials!
				}

				var respBody, respStatus;
				var options = {
					url: "https://" + domain + basePath,
					headers: {
						'Authorization': 'Basic ' + encodedCreds
					},
					qs: thisQueryString
				};

				var thisReq = request.get(options, function(err, resp, body) {

					if (err || !resp) {
						var statusText = "Unexpected error";
						if (err) {
							statusText = err;
						} else if (!resp) {
							statusText = "No response object";
						}
						node.status({
							fill: "red",
							shape: "ring",
							text: statusText
						});
					}
					msg.payload = body;
					msg.statusCode = resp.statusCode || resp.status;
					msg.headers = resp.headers;

					if (node.ret !== "bin") {
						msg.payload = body.toString('utf8'); // txt

						if (node.ret === "obj") {
							try {
								msg.payload = JSON.parse(body);
							} catch (e) {
								node.warn(RED._("c8yMeasurements.errors.json-error"));
							}
						}
					}

					node.send(msg);
				});

		}); // end of on.input

	} // end of c8yMeasurements fxn

	// Register the Node
	RED.nodes.registerType("c8y-measurements", c8yMeasurements, {
		credentials: {
			user: {
				type: "text"
			},
			password: {
				type: "password"
			}
		}
	});

};
