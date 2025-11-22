using Microsoft.AspNetCore.SignalR;

namespace Attendance.Web.Hubs
{
    // اگر می‌خواهی دسترسی فقط به کاربران لاگین داشته باشد، [Authorize] اضافه کن.
    public class StudentsHub : Hub
    {
        // فعلاً نیازی به متد سروری که کلاینت صدا بزنه نداریم — فقط از server -> client استفاده می‌کنیم.
    }
}
