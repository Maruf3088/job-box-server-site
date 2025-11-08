const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.port || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

app.use(cors());
app.use(express.json());

//DB_USER = job_hunter
//DB_PASS = o3wpAHhmiMxhigux

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1gjqpi3.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    //Job related APIs
    const jobCollection = client.db("Job-Box").collection("Jobs");
    const jobApplicationCollection = client
      .db("Job-Box")
      .collection("Job-Applications");

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};

      if (email) {
        query = { hr_email: email };
      }

      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const job = req.body;

      const result = await jobCollection.insertOne(job);
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    app.delete("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.deleteOne(query);
      res.send(result);
    });

    //job application APIs

    app.post("/job-applications", async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);

      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobCollection.findOne(query);

      let newCount = 0;
      if (job.applicationCount) {
        newCount = job.applicationCount + 1;
      } else {
        newCount = 1;
      }
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          applicationCount: newCount,
        },
      };
      const updateResult = await jobCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/job-application", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const jobs = await jobApplicationCollection.find(query).toArray();

        for (const job of jobs) {
          const jobid = job.job_id;

          // If jobid is not ObjectId type, safely handle it
          let jobQuery;
          try {
            jobQuery = { _id: new ObjectId(jobid) };
          } catch {
            console.warn(`Invalid ObjectId: ${jobid}`);
            continue; // skip this one
          }

          const jobDetails = await jobCollection.findOne(jobQuery);

          // ✅ Check if jobDetails exists
          if (jobDetails) {
            job.title = jobDetails.title;
            job.job_id = jobDetails._id;
            job.company = jobDetails.company;
            job.company_logo = jobDetails.company_logo;
            job.jobType = jobDetails.jobType;
            job.location = jobDetails.location;
            job.salaryRange = jobDetails.salaryRange;
          } else {
            console.warn(`No job found for ID: ${jobid}`);
          }
        }

        res.send(jobs);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    app.get("/job-applications", async (req, res) => {
      const id = req.query.id;
      const query = { job_id: id };
      const applicants = await jobApplicationCollection.find(query).toArray();
      res.send(applicants);
    });

    app.delete("/job-application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      // 1️⃣ Find the application first
      const application = await jobApplicationCollection.findOne(query);
      if (!application) {
        return res.status(404).send({ message: "Application not found" });
      }

      // 2️⃣ Delete the application
      const result = await jobApplicationCollection.deleteOne(query);

      // 3️⃣ Update job's application count
      const jobid = application.job_id;
      const job = await jobCollection.findOne({ _id: new ObjectId(jobid) });

      if (job) {
        const newCount = (job.applicationCount || 0) - 1;
        await jobCollection.updateOne(
          { _id: new ObjectId(jobid) },
          { $set: { applicationCount: newCount } }
        );
      }

      res.send(result);
    });

    app.get("/job-applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { job_id: id };

      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/job-applications/:id", async (req, res) => {
      const id = req.params.id;
      const application = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: application.status,
        },
      };
      const result = await jobApplicationCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("job is falling from the sky");
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
