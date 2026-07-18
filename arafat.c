// Even odd calc.
//#include<stdio.h>
//int main() {
// int num;
//
// // Ask the user for input
// printf("Enter an integer: ");
// scanf("%d", &num);
// // Check if the remainder is 0 when divided by 2
// if (num % 2 == 0) {
// printf("%d is even.\n",num);
// } else {
//      printf("%d is odd.\n",num);
// }
//
//return 0;
//}

//gpa grade calc.
#include<stdio.h>
int main() {
 int num;

 // Ask the user for input
 do {
 printf("Enter Mark(0-100): ");
 scanf("%d", &num);
  if(num < 0 || num > 100){
  printf("Invalid number!!! Enter number between 0 to 100 .\n");
  }
 } while(num < 0 || num >100);
 // Check if the number 80 and above
 if (num >= 80 && num <= 100) {
 printf("Your grade is A+ (%d).\n",num);
 }
 // Check if the number 70 and less 80
  else if (num >= 70 && num < 80) {
 printf("Your grade is A (%d).\n",num);
 }
  // Check if the number 60 and less 70
 else if (num >= 60 && num < 70) {
 printf("Your grade is A- (%d).\n",num);
 }
 // Check if the number 50 and less 60
 else if (num >= 50 && num < 60) {
 printf("Your grade is B (%d).\n",num);
 }  // Check if the number 40 and less 50
 else if (num >= 40 && num < 50) {
 printf("Your grade is C (%d).\n",num);
 }  // Check if the number 33 and less 40
 else if (num >= 33 && num < 40) {
 printf("Your grade is D (%d).\n",num);
 }
   // Check if the number 0 and less 33
   else
 printf("Your grade is F (%d).\n",num);

return 0;
}
