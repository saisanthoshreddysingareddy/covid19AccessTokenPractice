const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken = null;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const verification = jwt.verify(
      jwtToken,
      "zzzzz",
      async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      }
    );
  }
};

//Login Credentials
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const isUserRegistered = `
    SELECT * 
    FROM user
    WHERE username='${username}'`;
  const userRegisteredResponse = await db.get(isUserRegistered);
  if (userRegisteredResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatching = await bcrypt.compare(
      password,
      userRegisteredResponse.password
    );
    if (passwordMatching === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "zzzzz");
      response.send({ jwtToken });
    } else {
      response.status("400");
      response.send("Invalid password");
    }
  }
});
const onChanging = (getSingleResponse) => {
  return {
    stateId: getSingleResponse.state_id,
    stateName: getSingleResponse.state_name,
    population: getSingleResponse.population,
  };
};
const onChangingDistrict = (getting) => {
  return {
    districtId: getting.district_id,
    districtName: getting.district_name,
    stateId: getting.state_id,
    cases: getting.cases,
    cured: getting.cured,
    active: getting.active,
    deaths: getting.deaths,
  };
};
//Get States
app.get("/states/", authenticateToken, async (request, response) => {
  const getQuery = `
    SELECT *
    FROM state`;
  const getQueryResponse = await db.all(getQuery);
  response.send(getQueryResponse.map((eachItem) => onChanging(eachItem)));
});
//Get Single State
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getSingleStateQuery = `
    SELECT *
    FROM state
    WHERE state_id=${stateId}`;
  const getSingleResponse = await db.get(getSingleStateQuery);
  response.send(onChanging(getSingleResponse));
});
//Creating district in the district table
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addingDistrictQuery = `
    INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths})`;
  const addingResponse = await db.run(addingDistrictQuery);
  response.send("District Successfully Added");
});
//Get Single District
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const singleDistrictQuery = `
    SELECT *
    FROM district
    WHERE district_id='${districtId}'`;
    const singleDistrictResponse = await db.get(singleDistrictQuery);
    response.send(onChangingDistrict(singleDistrictResponse));
  }
);
//Deleting District
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM district
    WHERE district_id=${districtId}`;
    const deleteResponse = await db.run(deleteQuery);
    response.send("District Removed");
  }
);
//Updating District
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
    UPDATE district
    SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths}
    WHERE district_id=${districtId}`;
    const updateResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);
//Getting stats of state
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
    SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths)
    FROM district
    WHERE state_id=${stateId}`;
    const statsResponse = await db.get(statsQuery);
    response.send({
      totalCases: statsResponse["SUM(cases)"],
      totalCured: statsResponse["SUM(cured)"],
      totalActive: statsResponse["SUM(active)"],
      totalDeaths: statsResponse["SUM(deaths)"],
    });
  }
);
module.exports = app;
