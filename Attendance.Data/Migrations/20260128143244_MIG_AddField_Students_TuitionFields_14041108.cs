using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Data.Migrations
{
    /// <inheritdoc />
    public partial class MIG_AddField_Students_TuitionFields_14041108 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ApprovedSixMonthTuition",
                table: "Students",
                type: "decimal(18,0)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PaidAmountSoFar",
                table: "Students",
                type: "decimal(18,0)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedSixMonthTuition",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "PaidAmountSoFar",
                table: "Students");
        }
    }
}
