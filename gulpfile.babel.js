

import gulp from 'gulp';

import uglify from 'gulp-uglify';
import rename from 'gulp-rename';
import notify from 'gulp-notify';
import browserSync from 'browser-sync';

const  reload  = browserSync.create().reload;

gulp.task('scripts', () => {
  gulp.src('./src/scrollboy.js')
    .pipe(uglify())
    .pipe(rename('scrollboy.js'))
    .pipe(gulp.dest('./dist/'))
    .pipe(reload({stream: true}))
    .pipe(notify("Found file: <%= file.relative %>!"));
});


gulp.task('watch', () => {

    browserSync.init({
        server: './'
    });
    
    // 看守所有.js档
    gulp.watch('./src/js/*.js', ['scripts']);
    gulp.watch('./*.html',['scripts']);
    
});


gulp.task('default', ['scripts','watch'], () => {});