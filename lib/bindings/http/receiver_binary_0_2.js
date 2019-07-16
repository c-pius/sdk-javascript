const Constants  = require("./constants.js");
const Commons    = require("./commons.js");
const Cloudevent = require("../../cloudevent.js");
const Spec02     = require("../../specs/spec_0_2.js");

const JSONParser = require("../../formats/json/parser.js");

const parserByType = {};
parserByType[Constants.MIME_JSON] = new JSONParser();

const allowedContentTypes = [];
allowedContentTypes.push(Constants.MIME_JSON);

const requiredHeaders = [];
requiredHeaders.push(Constants.BINARY_HEADERS_02.TYPE);
requiredHeaders.push(Constants.BINARY_HEADERS_02.SPEC_VERSION);
requiredHeaders.push(Constants.BINARY_HEADERS_02.SOURCE);
requiredHeaders.push(Constants.BINARY_HEADERS_02.ID);

const setterReflections = {};
setterReflections[Constants.BINARY_HEADERS_02.TYPE] = {
  name : "type",
  parser : (v) => v
};
setterReflections[Constants.BINARY_HEADERS_02.SPEC_VERSION] = {
  name : "specversion",
  parser : (v) => "0.2"
};
setterReflections[Constants.BINARY_HEADERS_02.SOURCE] = {
  name : "source",
  parser: (v) => v
};
setterReflections[Constants.BINARY_HEADERS_02.ID] = {
  name : "id",
  parser : (v) => v
};
setterReflections[Constants.BINARY_HEADERS_02.TIME] = {
  name : "time",
  parser : (v) => new Date(Date.parse(v))
};
setterReflections[Constants.BINARY_HEADERS_02.SCHEMA_URL] = {
  name: "schemaurl",
  parser: (v) => v
};
setterReflections[Constants.HEADER_CONTENT_TYPE] = {
  name: "contenttype",
  parser: (v) => v
};

function validateArgs(payload, attributes) {
  if(!payload){
    throw {message: "payload is null or undefined"};
  }

  if(!attributes) {
    throw {message: "attributes is null or undefined"};
  }

  if((typeof payload) !== "object" && (typeof payload) !== "string"){
    throw {
      message: "payload must be an object or a string",
      errors: [typeof payload]
    };
  }
}

function Receiver(configuration) {

}

Receiver.prototype.check = function(payload, headers) {
  // Validation Level 0
  validateArgs(payload, headers);

  // Clone and low case all headers names
  var sanityHeaders = Commons.sanity_and_clone(headers);

  // Validation Level 1
  if(!allowedContentTypes
      .includes(sanityHeaders[Constants.HEADER_CONTENT_TYPE])){
        throw {
          message: "invalid content type",
          errors: [sanityHeaders[Constants.HEADER_CONTENT_TYPE]]
        };
  }

  for(i in requiredHeaders){
    if(!sanityHeaders[requiredHeaders[i]]){
      throw {message: "header '" + requiredHeaders[i] + "' not found"};
    }
  }

  if(sanityHeaders[Constants.BINARY_HEADERS_02.SPEC_VERSION] !== "0.2"){
    throw {
      message: "invalid spec version",
      errors: [sanityHeaders[Constants.BINARY_HEADERS_02.SPEC_VERSION]]
    };
  }

  // No erros! Its contains the minimum required attributes
}

Receiver.prototype.parse = function(payload, headers) {
  this.check(payload, headers);

  // Clone and low case all headers names
  var sanityHeaders = Commons.sanity_and_clone(headers);

  var processedHeaders = [];
  var cloudevent = new Cloudevent(Spec02);
  for(header in setterReflections) {
    // dont worry, check() have seen what was required or not
    if(sanityHeaders[header]){
      var setter_name = setterReflections[header].name;
      var parserFun   = setterReflections[header].parser;

      // invoke the setter function
      cloudevent[setter_name](parserFun(sanityHeaders[header]));

      // to use ahead, for extensions processing
      processedHeaders.push(header);
    }
  }

  // Parses the payload
  var parsedPayload =
    parserByType[sanityHeaders[Constants.HEADER_CONTENT_TYPE]]
      .parse(payload);

  // Every unprocessed header should be an extension
  Array.from(Object.keys(sanityHeaders))
  .filter(value => !processedHeaders.includes(value))
  .filter(value =>
    value.startsWith(Constants.BINARY_HEADERS_02.EXTENSIONS_PREFIX))
  .map(extension =>
    extension.substring(Constants.BINARY_HEADERS_02.EXTENSIONS_PREFIX.length)
  ).forEach(extension =>
    cloudevent.addExtension(extension,
      sanityHeaders[Constants.BINARY_HEADERS_02.EXTENSIONS_PREFIX+extension])
  );

  // Sets the data
  cloudevent.data(parsedPayload);

  // Checks the event spec
  cloudevent.format();

  // return the result
  return cloudevent;
}

module.exports = Receiver;