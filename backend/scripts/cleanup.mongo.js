// Run this in MongoDB shell to remove old cpu fields from all documents

// Clean telemetry collection
db.telemetry.updateMany(
  {},
  {
    $unset: {
      "temp_cpu": "",
      "cpu": "",
      "gpu": ""
    }
  }
);

// Clean realtime collection
db.realtime.updateMany(
  {},
  {
    $unset: {
      "metrics.temp_cpu": "",
      "metrics.cpu": "",
      "metrics.gpu": ""
    }
  }
);

// Verify cleanup
print("Telemetry docs with temp_cpu:", db.telemetry.countDocuments({ temp_cpu: { $exists: true } }));
print("Realtime docs with metrics.cpu:", db.realtime.countDocuments({ "metrics.cpu": { $exists: true } }));
