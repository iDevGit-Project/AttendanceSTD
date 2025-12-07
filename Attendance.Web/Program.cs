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
app.UseCors("AllowLocal");
app.UseAuthentication();
app.UseAuthorization();

// ** Map Hub **
app.MapHub<StudentsHub>("/hubs/studentHub");

// Map controller routes (single place)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();