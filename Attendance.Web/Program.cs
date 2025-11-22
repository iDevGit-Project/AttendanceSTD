using Attendance.Data.Conext;
using Attendance.Web.Hubs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Localization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Globalization;


var builder = WebApplication.CreateBuilder(args);
// ---------- DbContext & Identity ----------
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Memory cache
builder.Services.AddMemoryCache();

builder.Services.AddIdentity<IdentityUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireUppercase = false;
    // تنظیمات دیگر رمز عبور و حساب کاربری را این‌جا قرار دهید
})
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders()
    .AddDefaultUI();

// ---------- MVC/Razor + runtime compilation (برای توسعه) ----------
builder.Services.AddControllersWithViews();

// ---------- Localization (فارسی/RTL) ----------
builder.Services.AddLocalization();
var supportedCultures = new[] { new CultureInfo("fa-IR") };
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.DefaultRequestCulture = new RequestCulture("fa-IR");
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;
});

// ---------- All Register Services ----------
builder.Services.AddScoped<Attendance.Web.Services.FileService>();
builder.Services.AddSignalR();

// اگر cross-origin داری (مثلاً client روی پورت متفاوت)، اضافه کن:
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocal",
        policy => policy
            // اضافه کردم هر دو origin محتمل را؛ اگر می‌دانی فقط یکی لازم است آن را قرار بده
            .WithOrigins("https://localhost:7063", "https://localhost:44357")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

// ---------- Localization middleware ----------
var requestLocalizationOptions = app.Services.GetService<Microsoft.Extensions.Options.IOptions<RequestLocalizationOptions>>()?.Value;
if (requestLocalizationOptions != null)
{
    app.UseRequestLocalization(requestLocalizationOptions);
}

// ---------- Routing / CORS / Auth ----------
app.UseRouting();

// فعال‌سازی CORS (در صورت نیاز)
app.UseCors("AllowLocal");

// اگر از Identity استفاده می‌کنید، Authentication باید قبل از Authorization قرار بگیرد
app.UseAuthentication();
app.UseAuthorization();

// ** Map Hub **
// توجه: نام Hub را دقیقا مطابق کلاس Hub در پروژه قرار بده.
// در نمونه‌های قبلی کد شما از StudentHub استفاده شده بود؛ اگر کلاس شما StudentsHub نامیده شده آن را تغییر بده.
app.MapHub<StudentsHub>("/hubs/studentHub");

// Map controller routes (single place)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
//============================================================
// تنظیمات جهت داینامیک کردن اتصال به سرور و پایگاه داده به صورت لحظه ای
//using Attendance.Data.Conext;
//using Attendance.Web.Hubs;
//using Microsoft.AspNetCore.Identity;
//using Microsoft.AspNetCore.Localization;
//using Microsoft.EntityFrameworkCore;
//using Microsoft.Data.SqlClient; // << برای تست اتصال
//using System.Globalization;

//var builder = WebApplication.CreateBuilder(args);

//// ---------- Test DB Connection (Phase 1: Connection Failure detection) ----------
//string connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
//if (!string.IsNullOrWhiteSpace(connectionString))
//{
//    try
//    {
//        // تست سریع اتصال (سریع و ساده)
//        using var testConn = new SqlConnection(connectionString);
//        testConn.Open();
//        testConn.Close();
//        // اگر اینجا به exception نخوردیم، اتصال اولیه موفق بود.
//    }
//    catch (Exception ex)
//    {
//        // ثبت خطا در configuration برای استفادهٔ بعدی (مثلاً هدایت به صفحهٔ Setup)
//        builder.Configuration["ConnectionError"] = ex.Message;
//        // Log در کنسول (اختیاری، برای توسعه)
//        Console.ForegroundColor = ConsoleColor.Yellow;
//        Console.WriteLine("Warning: Database connection test failed. ConnectionError set in configuration.");
//        Console.WriteLine(ex.Message);
//        Console.ResetColor();
//    }
//}
//else
//{
//    builder.Configuration["ConnectionError"] = "Connection string 'DefaultConnection' is empty or missing.";
//    Console.ForegroundColor = ConsoleColor.Yellow;
//    Console.WriteLine("Warning: Connection string 'DefaultConnection' is empty or missing.");
//    Console.ResetColor();
//}

//// ---------- DbContext & Identity ----------
//builder.Services.AddDbContext<ApplicationDbContext>(options =>
//    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

//// Memory cache
//builder.Services.AddMemoryCache();

//builder.Services.AddIdentity<IdentityUser, IdentityRole>(options =>
//{
//    options.Password.RequireDigit = false;
//    options.Password.RequireUppercase = false;
//    // تنظیمات دیگر رمز عبور و حساب کاربری را این‌جا قرار دهید
//})
//    .AddEntityFrameworkStores<ApplicationDbContext>()
//    .AddDefaultTokenProviders()
//    .AddDefaultUI();

//// ---------- MVC/Razor + runtime compilation (برای توسعه) ----------
//builder.Services.AddControllersWithViews();

//// ---------- Localization (فارسی/RTL) ----------
//builder.Services.AddLocalization();
//var supportedCultures = new[] { new CultureInfo("fa-IR") };
//builder.Services.Configure<RequestLocalizationOptions>(options =>
//{
//    options.DefaultRequestCulture = new RequestCulture("fa-IR");
//    options.SupportedCultures = supportedCultures;
//    options.SupportedUICultures = supportedCultures;
//});

//// ---------- All Register Services ----------
//builder.Services.AddScoped<Attendance.Web.Services.FileService>();
//builder.Services.AddSignalR();

//// اگر cross-origin داری (مثلاً client روی پورت متفاوت)، اضافه کن:
//builder.Services.AddCors(options =>
//{
//    options.AddPolicy("AllowLocal",
//        policy => policy
//            // اضافه کردم هر دو origin محتمل را؛ اگر می‌دانی فقط یکی لازم است آن را قرار بده
//            .WithOrigins("https://localhost:7063", "https://localhost:44357")
//            .AllowAnyHeader()
//            .AllowAnyMethod()
//            .AllowCredentials());
//});

//var app = builder.Build();

//// ✅ Middleware برای تشخیص خطای SQL در هر لحظه
//app.Use(async (context, next) =>
//{
//    try
//    {
//        await next.Invoke();
//    }
//    catch (SqlException ex)
//    {
//        Console.WriteLine("❌ Database connection lost: " + ex.Message);
//        context.Response.Redirect("/Setup?message=Database+connection+failed");
//    }
//});

//// Configure the HTTP request pipeline.
//if (!app.Environment.IsDevelopment())
//{
//    app.UseExceptionHandler("/Home/Error");
//    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
//    app.UseHsts();
//}

//app.UseHttpsRedirection();
//app.UseStaticFiles();

//// ---------- Localization middleware ----------
//var requestLocalizationOptions = app.Services.GetService<Microsoft.Extensions.Options.IOptions<RequestLocalizationOptions>>()?.Value;
//if (requestLocalizationOptions != null)
//{
//    app.UseRequestLocalization(requestLocalizationOptions);
//}

//// ---------- Routing / CORS / Auth ----------
//app.UseRouting();

//// فعال‌سازی CORS (در صورت نیاز)
//app.UseCors("AllowLocal");

//// اگر از Identity استفاده می‌کنید، Authentication باید قبل از Authorization قرار بگیرد
//app.UseAuthentication();
//app.UseAuthorization();

//// ** Map Hub **
//// توجه: نام Hub را دقیقا مطابق کلاس Hub در پروژه قرار بده.
//// در نمونه‌های قبلی کد شما از StudentsHub استفاده شده بود؛ اگر کلاس شما StudentHub نامیده شده آن را تغییر بده.
//app.MapHub<StudentsHub>("/hubs/studentHub");

//// Map controller routes (single place)
//app.MapControllerRoute(
//    name: "default",
//    pattern: "{controller=Home}/{action=Index}/{id?}");

//// ---------- Optional: if connection test failed, you can choose to redirect/route to a Setup page.
//// Currently we only recorded the error in builder.Configuration["ConnectionError"].
//// If you want immediate fallback to a Setup controller when connection is invalid, uncomment below:
////
//// if (!string.IsNullOrEmpty(builder.Configuration["ConnectionError"]))
//// {
////     // اگر می‌خواهی پروژه به جای خطا، صفحه Setup را نمایش دهد:
////     app.MapFallbackToController("Index", "Setup");
//// }

//app.Run();