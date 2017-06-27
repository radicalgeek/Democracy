using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Democracy.Bills.Storage;

namespace Democracy.Controllers
{
    
        public class UploadController : Controller
        {
            public JsonResult UploadFile()
            {
                HttpPostedFileBase file = HttpContext.Request.Files[0];

                var uploadLocation = Path.GetTempPath();
                string result = "";
                if (file != null)
                {
                    var image = Image.FromStream(file.InputStream, true, true);
                    var fileNameWithPath = ProccessImage(new Bitmap(image), 200, 250, 75, uploadLocation, file.FileName);

                    var fileSystem = new AzureFileStorage();
                    var imageUrl = fileSystem.SaveImage(fileNameWithPath);


                    var serializer = new System.Web.Script.Serialization.JavaScriptSerializer();
                    result = serializer.Serialize(new { name = file.FileName, imgPath = imageUrl });
                }

                return Json(result);
            }

            private string ProccessImage(Bitmap image, int maxWidth, int maxHeight, int quality, string uploadLocation, string fileName)
            {
                int originalWidth = image.Width;
                int originalHeight = image.Height;

                // To preserve the aspect ratio
                float ratioX = (float)maxWidth / (float)originalWidth;
                float ratioY = (float)maxHeight / (float)originalHeight;
                float ratio = Math.Min(ratioX, ratioY);

                // New width and height based on aspect ratio
                int newWidth = (int)(originalWidth * ratio);
                int newHeight = (int)(originalHeight * ratio);

                // Convert other formats (including CMYK) to RGB.
                Bitmap newImage = new Bitmap(newWidth, newHeight, PixelFormat.Format24bppRgb);

                // Draws the image in the specified size with quality mode set to HighQuality
                using (Graphics graphics = Graphics.FromImage(newImage))
                {
                    graphics.CompositingQuality = CompositingQuality.HighQuality;
                    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    graphics.SmoothingMode = SmoothingMode.HighQuality;
                    graphics.DrawImage(image, 0, 0, newWidth, newHeight);
                }

                // Get an ImageCodecInfo object that represents the JPEG codec.
                ImageCodecInfo imageCodecInfo = this.GetEncoderInfo(ImageFormat.Jpeg);

                // Create an Encoder object for the Quality parameter.
                Encoder encoder = Encoder.Quality;

                // Create an EncoderParameters object. 
                EncoderParameters encoderParameters = new EncoderParameters(1);

                // Save the image as a JPEG file with quality level.
                EncoderParameter encoderParameter = new EncoderParameter(encoder, quality);
                encoderParameters.Param[0] = encoderParameter;



                var fileNameWithPath = String.Format("{0}{1}", uploadLocation, Guid.NewGuid() + fileName);

                newImage.Save(fileNameWithPath, imageCodecInfo, encoderParameters);
                return fileNameWithPath;
            }

            private ImageCodecInfo GetEncoderInfo(ImageFormat format)
            {
                return ImageCodecInfo.GetImageDecoders().SingleOrDefault(c => c.FormatID == format.Guid);
            }


        }
    }