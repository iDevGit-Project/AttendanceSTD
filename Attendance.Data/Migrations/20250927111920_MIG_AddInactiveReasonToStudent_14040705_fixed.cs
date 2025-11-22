using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Data.Migrations
{
    /// <inheritdoc />
    public partial class MIG_AddInactiveReasonToStudent_14040705_fixed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InactiveReason",
                table: "Students",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InactiveReason",
                table: "Students");
        }
    }
}
