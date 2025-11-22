using Attendance.Data.Entities;
using Attendance.Data.VModels.Attendances;
using Attendance.Data.VModels.Students;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Services
{
    public static class Mappers
    {
        public static AttendanceRecordItemViewModel ToViewModel(this AttendanceRecord r)
        {
            if (r == null) return new AttendanceRecordItemViewModel();

            return new AttendanceRecordItemViewModel
            {
                Id = r.Id,
                SessionId = r.SessionId,
                StudentId = r.StudentId,
                //Status = r.Status,
                CheckIn = r.CheckIn,
                CheckOut = r.CheckOut,
                Notes = r.Notes,
                Student = new StudentMiniViewModel
                {
                    Id = r.Student?.Id ?? r.StudentId,
                    FirstName = r.Student?.FirstName,
                    LastName = r.Student?.LastName,
                    NationalCode = r.Student?.NationalCode,
                    Grade = r.Student?.Grade,
                    SchoolName = r.Student?.SchoolName
                }
            };
        }

        public static AttendanceSessionDetailsViewModel ToDetailsVm(this AttendanceSession s, List<AttendanceRecord> recs)
        {
            if (s == null) return new AttendanceSessionDetailsViewModel();

            var recordsVm = (recs ?? new List<AttendanceRecord>())
                                .Select(r => r.ToViewModel())
                                .OrderBy(r => r.Student?.LastName)
                                .ThenBy(r => r.Student?.FirstName)
                                .ToList();

            return new AttendanceSessionDetailsViewModel
            {
                Id = s.Id,
                Title = s.Title,
                Date = s.Date,
                // use the helper from Attendance.Web.Entities.Helpers
                //DateShamsi = PersianDateConverter.ToShamsiString(s.Date),
                StartAt = s.StartAt,
                EndAt = s.EndAt,
                Location = s.Location,
                Notes = s.Notes,
                RecordsCount = recordsVm.Count,
                //PresentCount = recordsVm.Count(r => r.Status == Attendance.Data.Entities.AttendanceStatus.Present),
                //AbsentCount = recordsVm.Count(r => r.Status == Attendance.Data.Entities.AttendanceStatus.Absent),
                Records = recordsVm
            };
        }
    }
}
