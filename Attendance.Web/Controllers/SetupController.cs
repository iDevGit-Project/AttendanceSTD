//using Microsoft.AspNetCore.Mvc;
//using Microsoft.Data.SqlClient;
//using System.Text.Json.Nodes;

//namespace Attendance.Web.Controllers
//{
//    public class SetupController : Controller
//    {
//        private readonly IWebHostEnvironment _env;
//        private readonly IConfiguration _config;
//        private readonly ILogger<SetupController> _logger;

//        public SetupController(IWebHostEnvironment env, IConfiguration config, ILogger<SetupController> logger)
//        {
//            _env = env;
//            _config = config;
//            _logger = logger;
//        }

//        [HttpGet]
//        public IActionResult Index(string? message = null)
//        {
//            ViewBag.Message = message;
//            ViewBag.DefaultConnection = _config.GetConnectionString("DefaultConnection") ?? "";
//            return View();
//        }

//        [HttpPost]
//        [ValidateAntiForgeryToken]
//        public IActionResult SaveConnection(string server, string database, string user, string password)
//        {
//            var connStr = $"Server={server};Database={database};User ID={user};Password={password};Trusted_Connection=False;Trust Server Certificate=true;MultipleActiveResultSets=true";

//            try
//            {
//                using var conn = new SqlConnection(connStr);
//                conn.Open();
//                conn.Close();
//            }
//            catch (Exception ex)
//            {
//                ViewBag.Message = "❌ خطا در اتصال: " + ex.Message;
//                return View("Index");
//            }

//            try
//            {
//                var localPath = Path.Combine(_env.ContentRootPath, "appsettings.Local.json");

//                JsonObject root;
//                if (System.IO.File.Exists(localPath))
//                {
//                    var json = System.IO.File.ReadAllText(localPath);
//                    root = JsonNode.Parse(json)?.AsObject() ?? new JsonObject();
//                }
//                else
//                {
//                    root = new JsonObject();
//                }

//                if (!root.ContainsKey("ConnectionStrings"))
//                    root["ConnectionStrings"] = new JsonObject();

//                root["ConnectionStrings"]!["DefaultConnection"] = connStr;

//                var opts = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
//                System.IO.File.WriteAllText(localPath, root.ToJsonString(opts));

//                ViewBag.Message = "✅ اتصال ذخیره شد و آماده استفاده است.";
//            }
//            catch (Exception ex)
//            {
//                _logger.LogError(ex, "Error saving connection string");
//                ViewBag.Message = "❌ خطا در ذخیره تنظیمات: " + ex.Message;
//            }

//            return View("Index");
//        }

//        [HttpPost]
//        public IActionResult TestConnectionAjax([FromBody] ConnectionRequest request)
//        {
//            var result = new { ok = false, message = "" };

//            try
//            {
//                var connStr = $"Server={request.Server};Database={request.Database};User ID={request.User};Password={request.Password};Trusted_Connection=False;Trust Server Certificate=true;MultipleActiveResultSets=true";
//                using var conn = new SqlConnection(connStr);
//                conn.Open();
//                conn.Close();

//                result = new { ok = true, message = "✅ اتصال موفق بود!" };
//            }
//            catch (Exception ex)
//            {
//                result = new { ok = false, message = "❌ خطا در اتصال: " + ex.Message };
//            }

//            return Json(result);
//        }

//        public class ConnectionRequest
//        {
//            public string Server { get; set; }
//            public string Database { get; set; }
//            public string User { get; set; }
//            public string Password { get; set; }
//        }

//        [HttpPost]
//        public IActionResult SaveConnectionAjax([FromBody] ConnectionRequest request)
//        {
//            var connStr = $"Server={request.Server};Database={request.Database};User ID={request.User};Password={request.Password};Trusted_Connection=False;Trust Server Certificate=true;MultipleActiveResultSets=true";
//            var localPath = Path.Combine(_env.ContentRootPath, "appsettings.Local.json");

//            try
//            {
//                // ذخیره در فایل محلی
//                JsonObject root;
//                if (System.IO.File.Exists(localPath))
//                {
//                    var json = System.IO.File.ReadAllText(localPath);
//                    root = JsonNode.Parse(json)?.AsObject() ?? new JsonObject();
//                }
//                else
//                {
//                    root = new JsonObject();
//                }

//                if (!root.ContainsKey("ConnectionStrings"))
//                    root["ConnectionStrings"] = new JsonObject();

//                root["ConnectionStrings"]!["DefaultConnection"] = connStr;

//                var opts = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
//                System.IO.File.WriteAllText(localPath, root.ToJsonString(opts));

//                // بارگذاری مجدد تنظیمات در حافظه (بدون ری‌استارت)
//                var configurationRoot = (IConfigurationRoot)_config;
//                configurationRoot.Reload();

//                return Json(new { ok = true, message = "✅ اتصال ذخیره و تنظیمات مجدداً بارگذاری شد." });
//            }
//            catch (Exception ex)
//            {
//                return Json(new { ok = false, message = "❌ خطا در ذخیره تنظیمات: " + ex.Message });
//            }
//        }
//    }
//}
