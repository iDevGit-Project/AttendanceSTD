using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Data.Migrations
{
    /// <inheritdoc />
    public partial class MIG_AddStudentFormFields_14040718 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte>(
                name: "ConsentForm",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<byte>(
                name: "IQTest",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<byte>(
                name: "ParentInterviewForm",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<byte>(
                name: "PsychologyForm",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<byte>(
                name: "StudentInterviewForm",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<byte>(
                name: "TalentTest",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<byte>(
                name: "WarkTest",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<string>(
                name: "WorkgroupName",
                table: "Students",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsentForm",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "IQTest",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "ParentInterviewForm",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "PsychologyForm",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "StudentInterviewForm",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "TalentTest",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "WarkTest",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "WorkgroupName",
                table: "Students");
        }
    }
}
